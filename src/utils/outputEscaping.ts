/**
 * Output Escaping Utilities
 * 
 * This module provides comprehensive output escaping to prevent XSS attacks
 * when displaying user-generated content on webpages.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns Escaped HTML-safe text
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return text.replace(/[&<>"'`=\/]/g, (match) => htmlEscapes[match]);
}

/**
 * Escapes HTML attributes to prevent attribute-based XSS
 * @param text - The text to escape for attributes
 * @returns Escaped attribute-safe text
 */
export function escapeHtmlAttribute(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  // Escape quotes and other dangerous characters for attributes
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Escapes JavaScript content to prevent script injection
 * @param text - The text to escape for JavaScript
 * @returns Escaped JavaScript-safe text
 */
export function escapeJavaScript(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\b/g, '\\b')
    .replace(/\0/g, '\\0');
}

/**
 * Escapes CSS content to prevent CSS injection attacks
 * @param text - The text to escape for CSS
 * @returns Escaped CSS-safe text
 */
export function escapeCSS(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\A ')
    .replace(/\r/g, '\\D ')
    .replace(/\f/g, '\\C ')
    .replace(/\0/g, '\\0 ');
}

/**
 * Escapes URL content to prevent URL-based attacks
 * @param text - The text to escape for URLs
 * @returns Escaped URL-safe text
 */
export function escapeURL(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  // Only allow safe URL characters
  return encodeURIComponent(text);
}

/**
 * Escapes JSON content to prevent JSON injection
 * @param text - The text to escape for JSON
 * @returns Escaped JSON-safe text
 */
export function escapeJSON(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '\\b');
}

/**
 * Recursively escapes all string values in an object/array
 * @param data - The data to escape
 * @returns Data with all strings properly escaped
 */
export function escapeData(data: any): any {
  if (typeof data === 'string') {
    return escapeHtml(data);
  }

  if (Array.isArray(data)) {
    return data.map(escapeData);
  }

  if (data && typeof data === 'object') {
    const escaped: any = {};
    for (const [key, value] of Object.entries(data)) {
      escaped[key] = escapeData(value);
    }
    return escaped;
  }

  return data;
}

/**
 * Escapes content for specific HTML contexts
 * @param text - The text to escape
 * @param context - The HTML context (text, attribute, script, style, url)
 * @returns Context-appropriate escaped text
 */
export function escapeForContext(text: string, context: 'text' | 'attribute' | 'script' | 'style' | 'url'): string {
  switch (context) {
    case 'text':
      return escapeHtml(text);
    case 'attribute':
      return escapeHtmlAttribute(text);
    case 'script':
      return escapeJavaScript(text);
    case 'style':
      return escapeCSS(text);
    case 'url':
      return escapeURL(text);
    default:
      return escapeHtml(text);
  }
}

/**
 * Creates a safe HTML string by escaping all user content
 * @param template - Template string with placeholders
 * @param values - Values to safely interpolate
 * @returns Safe HTML string
 */
export function safeHtml(template: string, ...values: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[parseInt(index)];
    return escapeHtml(String(value));
  });
}

/**
 * Creates a safe attribute string
 * @param template - Template string with placeholders
 * @param values - Values to safely interpolate
 * @returns Safe attribute string
 */
export function safeAttribute(template: string, ...values: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[parseInt(index)];
    return escapeHtmlAttribute(String(value));
  });
}

/**
 * Creates a safe JavaScript string
 * @param template - Template string with placeholders
 * @param values - Values to safely interpolate
 * @returns Safe JavaScript string
 */
export function safeJavaScript(template: string, ...values: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[parseInt(index)];
    return escapeJavaScript(String(value));
  });
}

/**
 * Creates a safe CSS string
 * @param template - Template string with placeholders
 * @param values - Values to safely interpolate
 * @returns Safe CSS string
 */
export function safeCSS(template: string, ...values: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[parseInt(index)];
    return escapeCSS(String(value));
  });
}

/**
 * Creates a safe URL string
 * @param template - Template string with placeholders
 * @param values - Values to safely interpolate
 * @returns Safe URL string
 */
export function safeURL(template: string, ...values: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = values[parseInt(index)];
    return escapeURL(String(value));
  });
}

/**
 * React hook for safely rendering user content
 * @param content - The user content to render safely
 * @returns Object with safe rendering methods
 */
export function useSafeContent(content: string) {
  return {
    asText: () => escapeHtml(content),
    asAttribute: () => escapeHtmlAttribute(content),
    asScript: () => escapeJavaScript(content),
    asStyle: () => escapeCSS(content),
    asURL: () => escapeURL(content),
    asHTML: () => ({ __html: escapeHtml(content) })
  };
}

/**
 * Higher-order component that automatically escapes all props
 * @param Component - The component to wrap
 * @returns Component with automatic escaping
 */
/**
 * Higher-order component that automatically escapes all props
 * Note: This function is for documentation purposes only
 * Use the individual escaping functions directly in your components
 */
export function withAutoEscaping<P extends Record<string, any>>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  // This function is for documentation purposes only
  // Use the individual escaping functions directly in your components
  // Example: <SafeText content={escapeHtml(userData)} />
  return Component;
}

/**
 * Utility to check if content contains potentially dangerous patterns
 * @param content - The content to check
 * @returns Object with security analysis results
 */
export function analyzeContentSecurity(content: string): {
  hasScriptTags: boolean;
  hasEventHandlers: boolean;
  hasDangerousProtocols: boolean;
  hasUnsafeAttributes: boolean;
  riskLevel: 'low' | 'medium' | 'high';
} {
  const patterns = {
    scriptTags: /<script[^>]*>.*?<\/script>/gi,
    eventHandlers: /on\w+\s*=/gi,
    dangerousProtocols: /(javascript|data|vbscript):/gi,
    unsafeAttributes: /(javascript|data|vbscript):/gi
  };

  const hasScriptTags = patterns.scriptTags.test(content);
  const hasEventHandlers = patterns.eventHandlers.test(content);
  const hasDangerousProtocols = patterns.dangerousProtocols.test(content);
  const hasUnsafeAttributes = patterns.unsafeAttributes.test(content);

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (hasScriptTags || hasEventHandlers) {
    riskLevel = 'high';
  } else if (hasDangerousProtocols || hasUnsafeAttributes) {
    riskLevel = 'medium';
  }

  return {
    hasScriptTags,
    hasEventHandlers,
    hasDangerousProtocols,
    hasUnsafeAttributes,
    riskLevel
  };
}

/**
 * Content Security Policy builder
 * @param options - CSP configuration options
 * @returns CSP header string
 */
export function buildCSPHeader(options: {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  sandbox?: boolean;
  upgradeInsecureRequests?: boolean;
}): string {
  const directives: string[] = [];

  if (options.defaultSrc) {
    directives.push(`default-src ${options.defaultSrc.join(' ')}`);
  }

  if (options.scriptSrc) {
    directives.push(`script-src ${options.scriptSrc.join(' ')}`);
  }

  if (options.styleSrc) {
    directives.push(`style-src ${options.styleSrc.join(' ')}`);
  }

  if (options.imgSrc) {
    directives.push(`img-src ${options.imgSrc.join(' ')}`);
  }

  if (options.connectSrc) {
    directives.push(`connect-src ${options.connectSrc.join(' ')}`);
  }

  if (options.fontSrc) {
    directives.push(`font-src ${options.fontSrc.join(' ')}`);
  }

  if (options.objectSrc) {
    directives.push(`object-src ${options.objectSrc.join(' ')}`);
  }

  if (options.mediaSrc) {
    directives.push(`media-src ${options.mediaSrc.join(' ')}`);
  }

  if (options.frameSrc) {
    directives.push(`frame-src ${options.frameSrc.join(' ')}`);
  }

  if (options.sandbox) {
    directives.push('sandbox');
  }

  if (options.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

/**
 * Default secure CSP header for NMS application
 */
export const defaultCSPHeader = buildCSPHeader({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", "https:"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  sandbox: true,
  upgradeInsecureRequests: true
});

export default {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  escapeCSS,
  escapeURL,
  escapeJSON,
  escapeData,
  escapeForContext,
  safeHtml,
  safeAttribute,
  safeJavaScript,
  safeCSS,
  safeURL,
  useSafeContent,
  withAutoEscaping,
  analyzeContentSecurity,
  buildCSPHeader,
  defaultCSPHeader
};
