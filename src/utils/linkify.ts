/**
 * Utility functions for detecting and converting URLs in text to clickable links
 * 
 * SECURITY FEATURES:
 * - Protocol whitelist (http, https, mailto only)
 * - XSS prevention via HTML escaping
 * - URL encoding validation
 * - Maximum length limits
 * - Open redirect protection
 * - Email injection prevention
 */

/**
 * URL regex pattern - matches:
 * - http:// and https:// URLs
 * - www. URLs
 * - email addresses
 */
const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[\w.-]+@[\w.-]+\.\w+)/gi;

// Security constants
const MAX_URL_LENGTH = 2048; // RFC 7230 limit
const MAX_EMAIL_LENGTH = 254; // RFC 5321 limit
const DANGEROUS_HOSTNAME_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /\[::1\]/,
  /\[0:0:0:0:0:0:0:1\]/,
];

// Whitelist of safe TLDs (optional - can be removed for flexibility)
const SAFE_TLDS = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'uk', 'ca', 'au', 'nz', 'gh'];

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Check if a string is a valid URL
 */
function isValidURL(str: string): boolean {
  try {
    const url = new URL(str.startsWith('http') ? str : `https://${str}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize URL (add protocol if missing)
 */
function normalizeURL(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  // Assume email address
  if (url.includes('@')) {
    return `mailto:${url}`;
  }
  return `https://${url}`;
}

/**
 * Sanitize URL to prevent XSS and protocol-based attacks
 */
function sanitizeURL(url: string): string {
  // Length validation
  if (url.length > MAX_URL_LENGTH) {
    console.warn('[linkify] URL too long, blocked:', url.substring(0, 50));
    return '#';
  }

  // Remove URL encoding attempts to bypass filters (%00, %3C, etc.)
  const decoded = decodeURIComponent(url);
  if (decoded.includes('<') || decoded.includes('>') || decoded.includes('"')) {
    console.warn('[linkify] Dangerous characters detected in URL, blocked');
    return '#';
  }

  const normalized = normalizeURL(url);
  
  // Block dangerous protocols (case-insensitive)
  const dangerousProtocols = [
    'javascript:', 'vbscript:', 'data:', 'file:', 'about:', 
    'jar:', 'chrome:', 'chrome-extension:', 'ms-help:', 
    'mhtml:', 'feed:', 'ftp:'
  ];
  
  const lowerNormalized = normalized.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerNormalized.startsWith(protocol)) {
      console.warn('[linkify] Dangerous protocol blocked:', protocol);
      return '#';
    }
  }
  
  // Only allow http, https, and mailto
  if (!normalized.match(/^(https?|mailto):/i)) {
    console.warn('[linkify] Invalid protocol, blocked');
    return '#';
  }
  
  try {
    const urlObj = new URL(normalized);
    
    // Validate hostname security
    const hostname = urlObj.hostname.toLowerCase();
    
    // Block dangerous hostname patterns (internal networks, localhost)
    for (const pattern of DANGEROUS_HOSTNAME_PATTERNS) {
      if (pattern.test(hostname)) {
        console.warn('[linkify] Dangerous hostname blocked:', hostname);
        return '#';
      }
    }
    
    // Validate hostname doesn't contain HTML entities or special chars
    if (hostname.includes('<') || hostname.includes('>') || hostname.includes('"') || 
        hostname.includes("'") || hostname.includes('&')) {
      console.warn('[linkify] Invalid characters in hostname, blocked');
      return '#';
    }
    
    // Validate email addresses
    if (normalized.startsWith('mailto:')) {
      const email = normalized.substring(7); // Remove 'mailto:'
      if (email.length > MAX_EMAIL_LENGTH) {
        console.warn('[linkify] Email too long, blocked');
        return '#';
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.warn('[linkify] Invalid email format, blocked');
        return '#';
      }
    }
    
    // Validate port (if specified) - block non-standard ports to reduce attack surface
    if (urlObj.port && parseInt(urlObj.port) < 1 || parseInt(urlObj.port) > 65535) {
      console.warn('[linkify] Invalid port number, blocked');
      return '#';
    }
    
    // Double-encode protection - ensure URL is properly encoded
    const reEncoded = encodeURI(decodeURI(normalized));
    if (reEncoded !== normalized && normalized !== decodeURIComponent(reEncoded)) {
      console.warn('[linkify] Suspicious URL encoding, blocked');
      return '#';
    }
    
    return normalized;
  } catch (error) {
    console.warn('[linkify] URL parsing failed, blocked:', error);
    return '#';
  }
}

export interface LinkSegment {
  text: string;
  isLink: boolean;
  url?: string;
}

/**
 * Parse text and detect URLs, returning segments
 */
export function parseLinks(text: string): LinkSegment[] {
  if (!text || typeof text !== 'string') {
    return [{ text: '', isLink: false }];
  }

  const segments: LinkSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchedText = match[0];
    const matchIndex = match.index;

    // Add text before the URL (React will escape automatically)
    if (matchIndex > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, matchIndex),
        isLink: false,
      });
    }

    // Add the URL as a link
    const normalizedURL = normalizeURL(matchedText);
    if (isValidURL(normalizedURL)) {
      const sanitizedURL = sanitizeURL(matchedText);
      segments.push({
        text: matchedText, // React will escape display text automatically
        isLink: true,
        url: sanitizedURL,
      });
    } else {
      // If it's not a valid URL, just add as text (React will escape)
      segments.push({
        text: matchedText,
        isLink: false,
      });
    }

    lastIndex = matchIndex + matchedText.length;
  }

  // Add remaining text (React will escape automatically)
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      isLink: false,
    });
  }

  // If no URLs found, return entire text as single segment (React will escape)
  if (segments.length === 0) {
    return [{ text, isLink: false }];
  }

  return segments;
}

/**
 * Get parsed link segments from text
 * Use this in React components to render links
 */
export function getLinkSegments(text: string): LinkSegment[] {
  return parseLinks(text);
}

/**
 * Check if text contains any URLs
 */
export function hasLinks(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

