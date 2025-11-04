export const testSecurityHeaders = async (url: string = window.location.href) => {
  try {
    const response = await fetch(url);
    const headers = response.headers;
    
    const requiredHeaders = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com; img-src 'self' data: https: blob: https://*.google.com https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https: wss: https://*.google.com https://*.googleapis.com; font-src 'self' data: https: https://*.google.com https://*.gstatic.com; object-src 'none'; media-src 'self'; frame-src 'self' https://www.google.com https://*.googleapis.com; worker-src 'self' blob:; manifest-src 'self'; prefetch-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-XSS-Protection': '1; mode=block',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-site'
    };

    const normalizeHeaderValue = (value: string | null) => {
      if (!value) return '';
      return value.toLowerCase().replace(/\s+/g, ' ').trim();
    };

    const results = Object.entries(requiredHeaders).map(([header, expectedValue]) => {
      const actualValue = headers.get(header);
      const normalizedExpected = normalizeHeaderValue(expectedValue);
      const normalizedActual = normalizeHeaderValue(actualValue);
      
      // For Content-Security-Policy, we'll do a more lenient check
      if (header === 'Content-Security-Policy') {
        const expectedDirectives = new Set(normalizedExpected.split(';').map(d => d.trim()));
        const actualDirectives = new Set(normalizedActual.split(';').map(d => d.trim()));
        const missingDirectives = [...expectedDirectives].filter(d => !actualDirectives.has(d));
        const hasAllRequired = missingDirectives.length === 0;
        
        return {
          header,
          expected: expectedValue,
          actual: actualValue,
          status: hasAllRequired ? '✅' : '❌',
          details: hasAllRequired ? '' : `Missing directives: ${missingDirectives.join(', ')}`
        };
      }
      
      // For other headers, provide detailed comparison
      if (!actualValue) {
        return {
          header,
          expected: expectedValue,
          actual: actualValue,
          status: '❌',
          details: 'Header not set'
        };
      }

      if (normalizedActual !== normalizedExpected) {
        let details = 'Value mismatch:';
        if (header === 'Strict-Transport-Security') {
          const expectedMaxAge = normalizedExpected.match(/max-age=(\d+)/)?.[1];
          const actualMaxAge = normalizedActual.match(/max-age=(\d+)/)?.[1];
          if (expectedMaxAge && actualMaxAge && expectedMaxAge !== actualMaxAge) {
            details += ` Max-age mismatch (expected: ${expectedMaxAge}, actual: ${actualMaxAge})`;
          }
          if (!normalizedActual.includes('includesubdomains') && normalizedExpected.includes('includesubdomains')) {
            details += ' Missing includeSubDomains directive';
          }
          if (!normalizedActual.includes('preload') && normalizedExpected.includes('preload')) {
            details += ' Missing preload directive';
          }
        } else if (header === 'Permissions-Policy') {
          const expectedFeatures = new Set(normalizedExpected.match(/\(([^)]+)\)/g)?.map(f => f.slice(1, -1)) || []);
          const actualFeatures = new Set(normalizedActual.match(/\(([^)]+)\)/g)?.map(f => f.slice(1, -1)) || []);
          const missingFeatures = [...expectedFeatures].filter(f => !actualFeatures.has(f));
          if (missingFeatures.length > 0) {
            details += ` Missing features: ${missingFeatures.join(', ')}`;
          }
        } else {
          details += ` Expected "${normalizedExpected}" but got "${normalizedActual}"`;
        }
        
        return {
          header,
          expected: expectedValue,
          actual: actualValue,
          status: '❌',
          details
        };
      }
      
      return {
        header,
        expected: expectedValue,
        actual: actualValue,
        status: '✅',
        details: ''
      };
    });

    console.table(results);
    return results;
  } catch (error) {
    console.error('Error testing security headers:', error);
    throw error;
  }
}; 