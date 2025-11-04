import { SHA256 } from 'crypto-js';
import DOMPurify from 'dompurify';
import { z } from 'zod';
import { UserRole } from '@/lib/types';
import bcrypt from 'bcryptjs';

// Session token interface
export interface SessionToken {
  token: string;
  csrfToken: string;
  expiresAt: number;
  userId: string;
  lastRotated: number;
}

// Input validation schemas
export const userSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/^[A-Za-z0-9]+$/, "Password can only contain letters and numbers"),
  name: z.string().min(2),
  role: z.enum(['district_engineer', 'regional_engineer', 'global_engineer', 'system_admin', 'technician', 'district_manager', 'regional_general_manager', 'ict', 'project_engineer']),
  region: z.string().optional(),
  district: z.string().optional()
});

// Password validation schema
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Password hashing with bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12); // Generate salt with 12 rounds
  return bcrypt.hash(password, salt);
};

// Password verification
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// CSRF token generation
export const generateCSRFToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Session token generation
export const generateSessionToken = (userId: string): SessionToken => {
  return {
    token: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    csrfToken: generateCSRFToken(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    userId,
    lastRotated: Date.now()
  };
};

// Session validation
export const validateSessionToken = (token: SessionToken): boolean => {
  return token.expiresAt > Date.now();
};

// Session storage in httpOnly cookies
export const storeSession = (session: SessionToken): void => {
  const secure = window.location.protocol === 'https:';
  document.cookie = `session=${JSON.stringify(session)}; path=/; httpOnly; ${secure ? 'secure;' : ''} sameSite=strict`;
};

// Role hierarchy for access control
const roleHierarchy: { [key in Exclude<UserRole, null>]: number } = {
  system_admin: 5,
  admin: 4,
  global_engineer: 3,
  regional_engineer: 2,
  project_engineer: 2,
  regional_general_manager: 3,
  district_manager: 2,
  district_engineer: 2,
  technician: 1,
  ict: 2,
  load_monitoring_edit: 2,
  load_monitoring_delete: 3
};

// Role-based access validation
export const hasRequiredRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  if (!userRole || !requiredRole) return false;
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// XSS Protection Utilities
export class XSSProtection {
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHTML(html: string, allowedTags?: string[], allowedAttrs?: string[]): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags || ['strong', 'em', 'b', 'i', 'span', 'div', 'p'],
      ALLOWED_ATTR: allowedAttrs || ['class', 'style', 'id']
    });
  }

  /**
   * Sanitize text content (removes all HTML)
   */
  static sanitizeText(text: string): string {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  /**
   * Create safe HTML element with sanitized content
   */
  static createSafeElement(tag: string, content: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    element.innerHTML = this.sanitizeHTML(content);
    
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (this.isSafeAttribute(key, value)) {
          element.setAttribute(key, value);
        }
      });
    }
    
    return element;
  }

  /**
   * Check if attribute is safe to set
   */
  private static isSafeAttribute(name: string, value: string): boolean {
    const safeAttributes = ['class', 'id', 'style', 'title', 'alt', 'src', 'href'];
    const safeAttributePatterns = [
      /^data-[a-z-]+$/, // data-* attributes
      /^aria-[a-z-]+$/, // aria-* attributes
    ];

    if (safeAttributes.includes(name)) return true;
    return safeAttributePatterns.some(pattern => pattern.test(name));
  }

  /**
   * Validate and sanitize user input
   */
  static validateAndSanitizeInput(input: unknown, schema: z.ZodSchema): unknown {
    try {
      const validated = schema.parse(input);
      return this.sanitizeObject(validated);
    } catch (error) {
      throw new Error(`Input validation failed: ${error}`);
    }
  }

  /**
   * Recursively sanitize object properties
   */
  static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeText(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }
}

// Enhanced input validation
export const validateUserInput = (input: unknown) => {
  return userSchema.parse(input);
};

// Enhanced password validation
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Enhanced XSS protection
export const sanitizeInput = (input: string): string => {
  return XSSProtection.sanitizeText(input);
};

// Enhanced HTML sanitization
export const sanitizeHTML = (html: string): string => {
  return XSSProtection.sanitizeHTML(html);
};

// Enhanced input validation with sanitization
export const validateAndSanitizeUserInput = (input: unknown) => {
  const validated = validateUserInput(input);
  return XSSProtection.sanitizeObject(validated);
};

// Security headers configuration
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.youtube.com https://*.youtube.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://www.youtube.com https://*.youtube.com https://*.googlevideo.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; media-src 'self' https://www.youtube.com https://*.youtube.com https://*.googlevideo.com; frame-src 'self' https://www.youtube.com https://*.youtube.com https://*.youtu.be https://player.vimeo.com;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-XSS-Protection': '1; mode=block',
  'X-DNS-Prefetch-Control': 'off',
  'Expect-CT': 'max-age=86400, enforce',
  'Feature-Policy': "geolocation 'none'; microphone 'none'; camera 'none'"
};

// CSRF Protection
export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  return token === storedToken;
};

// Rate limiting utilities
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);
    
    if (!attempt || now > attempt.resetTime) {
      this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (attempt.count >= this.maxAttempts) {
      return false;
    }
    
    attempt.count++;
    return true;
  }
  
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
  
  getRemainingAttempts(identifier: string): number {
    const attempt = this.attempts.get(identifier);
    if (!attempt) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - attempt.count);
  }
} 