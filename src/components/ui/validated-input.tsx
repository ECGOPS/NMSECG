import React, { forwardRef, useState, useEffect } from 'react';
import { Input } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useFieldValidation } from '@/hooks/useFormValidation';

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

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  schema: any; // Zod schema
  field: string;
  value: any;
  onValueChange: (value: any) => void;
  showValidation?: boolean;
  className?: string;
  errorClassName?: string;
  successClassName?: string;
  loadingClassName?: string;
  autoSanitize?: boolean; // Enable/disable automatic sanitization
}

export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ 
    label, 
    schema, 
    field, 
    value, 
    onValueChange, 
    showValidation = true,
    className,
    errorClassName = "border-red-500 focus:border-red-500 focus:ring-red-500",
    successClassName = "border-green-500 focus:border-green-500 focus:ring-green-500",
    loadingClassName = "border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500",
    autoSanitize = true, // Default to true for security
    ...props 
  }, ref) => {
    const [isTouched, setIsTouched] = useState(false);
    const [internalValue, setInternalValue] = useState(value);
    
    const { error, isValidating, isValid, sanitizedValue } = useFieldValidation(
      schema, 
      field, 
      internalValue, 
      isTouched
    );

    // Update internal value when external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;
      
      // Apply sanitization if enabled
      if (autoSanitize) {
        newValue = sanitizeString(newValue);
      }
      
      setInternalValue(newValue);
      onValueChange(newValue);
    };

    const handleBlur = () => {
      setIsTouched(true);
      
      // Apply sanitization on blur if not already done
      if (autoSanitize && typeof internalValue === 'string') {
        const sanitized = sanitizeString(internalValue);
        if (sanitized !== internalValue) {
          setInternalValue(sanitized);
          onValueChange(sanitized);
        }
      }
    };

    const handleFocus = () => {
      if (error) {
        setIsTouched(true);
      }
    };

    // Determine input styling based on validation state
    const getInputClassName = () => {
      if (!showValidation || !isTouched) {
        return className;
      }

      if (isValidating) {
        return cn(className, loadingClassName);
      }

      if (error) {
        return cn(className, errorClassName);
      }

      if (isValid && isTouched) {
        return cn(className, successClassName);
      }

      return className;
    };

    // Get status icon
    const getStatusIcon = () => {
      if (!showValidation || !isTouched) {
        return null;
      }

      if (isValidating) {
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      }

      if (error) {
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      }

      if (isValid && isTouched) {
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      }

      return null;
    };

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id || field} className="text-sm font-medium">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        
        <div className="relative">
          <Input
            ref={ref}
            value={internalValue || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className={getInputClassName()}
            {...props}
          />
          
          {showValidation && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {getStatusIcon()}
            </div>
          )}
        </div>

        {showValidation && isTouched && error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        {showValidation && isTouched && isValid && !isValidating && (
          <p className="text-sm text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Valid
          </p>
        )}

        {/* Show sanitization indicator if value was sanitized */}
        {autoSanitize && sanitizedValue !== value && (
          <p className="text-xs text-blue-500 flex items-center gap-1">
            <CheckCircle2 className="h-2 w-2" />
            Input sanitized for security
          </p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

// Enhanced Select component with validation and sanitization
interface ValidatedSelectProps {
  label?: string;
  schema: any;
  field: string;
  value: any;
  onValueChange: (value: any) => void;
  showValidation?: boolean;
  children: React.ReactNode;
  className?: string;
  errorClassName?: string;
  successClassName?: string;
  autoSanitize?: boolean;
}

export const ValidatedSelect: React.FC<ValidatedSelectProps> = ({
  label,
  schema,
  field,
  value,
  onValueChange,
  showValidation = true,
  children,
  className,
  errorClassName = "border-red-500 focus:border-red-500 focus:ring-red-500",
  successClassName = "border-green-500 focus:border-green-500 focus:ring-green-500",
  autoSanitize = true,
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  
  const { error, isValidating, isValid, sanitizedValue } = useFieldValidation(
    schema, 
    field, 
    internalValue, 
    isTouched
  );

  // Update internal value when external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleValueChange = (newValue: string) => {
    let sanitizedValue = newValue;
    
    // Apply sanitization if enabled
    if (autoSanitize) {
      sanitizedValue = sanitizeString(newValue);
    }
    
    setInternalValue(sanitizedValue);
    onValueChange(sanitizedValue);
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const getSelectClassName = () => {
    if (!showValidation || !isTouched) {
      return className;
    }

    if (error) {
      return cn(className, errorClassName);
    }

    if (isValid && isTouched) {
      return cn(className, successClassName);
    }

    return className;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label}
        </Label>
      )}
      
      <div className="relative">
        <select
          value={internalValue || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            getSelectClassName()
          )}
        >
          {children}
        </select>
        
        {showValidation && isTouched && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {error ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : null}
          </div>
        )}
      </div>

      {showValidation && isTouched && error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}

      {/* Show sanitization indicator if value was sanitized */}
      {autoSanitize && sanitizedValue !== value && (
        <p className="text-xs text-blue-500 flex items-center gap-1">
          <CheckCircle2 className="h-2 w-2" />
          Input sanitized for security
        </p>
      )}
    </div>
  );
};

// Enhanced Textarea component with validation and sanitization
interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  schema: any;
  field: string;
  value: any;
  onValueChange: (value: any) => void;
  showValidation?: boolean;
  className?: string;
  errorClassName?: string;
  successClassName?: string;
  autoSanitize?: boolean;
}

export const ValidatedTextarea = forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  ({ 
    label, 
    schema, 
    field, 
    value, 
    onValueChange, 
    showValidation = true,
    className,
    errorClassName = "border-red-500 focus:border-red-500 focus:ring-red-500",
    successClassName = "border-green-500 focus:border-green-500 focus:ring-green-500",
    autoSanitize = true,
    ...props 
  }, ref) => {
    const [isTouched, setIsTouched] = useState(false);
    const [internalValue, setInternalValue] = useState(value);
    
    const { error, isValidating, isValid, sanitizedValue } = useFieldValidation(
      schema, 
      field, 
      internalValue, 
      isTouched
    );

    // Update internal value when external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let newValue = e.target.value;
      
      // Apply sanitization if enabled
      if (autoSanitize) {
        newValue = sanitizeString(newValue);
      }
      
      setInternalValue(newValue);
      onValueChange(newValue);
    };

    const handleBlur = () => {
      setIsTouched(true);
      
      // Apply sanitization on blur if not already done
      if (autoSanitize && typeof internalValue === 'string') {
        const sanitized = sanitizeString(internalValue);
        if (sanitized !== internalValue) {
          setInternalValue(sanitized);
          onValueChange(sanitized);
        }
      }
    };

    const getTextareaClassName = () => {
      if (!showValidation || !isTouched) {
        return className;
      }

      if (error) {
        return cn(className, errorClassName);
      }

      if (isValid && isTouched) {
        return cn(className, successClassName);
      }

      return className;
    };

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id || field} className="text-sm font-medium">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        
        <textarea
          ref={ref}
          value={internalValue || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            getTextareaClassName()
          )}
          {...props}
        />

        {showValidation && isTouched && error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}

        {showValidation && isTouched && isValid && (
          <p className="text-sm text-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Valid
          </p>
        )}

        {/* Show sanitization indicator if value was sanitized */}
        {autoSanitize && sanitizedValue !== value && (
          <p className="text-xs text-blue-500 flex items-center gap-1">
            <CheckCircle2 className="h-2 w-2" />
            Input sanitized for security
          </p>
        )}
      </div>
    );
  }
);

ValidatedTextarea.displayName = 'ValidatedTextarea';
