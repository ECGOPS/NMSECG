/**
 * File Upload Security Middleware
 * 
 * Comprehensive security measures for file uploads:
 * - File type validation (whitelist)
 * - File extension validation
 * - File size limits
 * - File name sanitization
 * - Content type validation
 * - Magic number/file signature validation
 * - Path traversal prevention
 */

const path = require('path');
const fs = require('fs');

/**
 * Allowed file types and their MIME types
 */
const ALLOWED_FILE_TYPES = {
  // Document types
  'pdf': ['application/pdf'],
  'doc': ['application/msword'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'xls': ['application/vnd.ms-excel'],
  'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  'ppt': ['application/vnd.ms-powerpoint'],
  'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  'txt': ['text/plain'],
  'csv': ['text/csv', 'application/vnd.ms-excel'],
  // Image types (for reports with images)
  'jpg': ['image/jpeg'],
  'jpeg': ['image/jpeg'],
  'png': ['image/png'],
  'gif': ['image/gif'],
};

/**
 * Maximum file size (100MB)
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * File signature/magic numbers for validation
 */
const FILE_SIGNATURES = {
  'pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'doc': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // MS Office (old)
  'docx': [0x50, 0x4B, 0x03, 0x04], // ZIP/Office (new) - starts with PK
  'xls': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // MS Office (old)
  'xlsx': [0x50, 0x4B, 0x03, 0x04], // ZIP/Office (new)
  'ppt': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // MS Office (old)
  'pptx': [0x50, 0x4B, 0x03, 0x04], // ZIP/Office (new)
  'txt': null, // Text files don't have a fixed signature
  'csv': null, // CSV files don't have a fixed signature
  'jpg': [0xFF, 0xD8, 0xFF],
  'jpeg': [0xFF, 0xD8, 0xFF],
  'png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'gif': [0x47, 0x49, 0x46, 0x38], // GIF8
};

/**
 * Dangerous file extensions (executable, script files)
 */
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
  'app', 'deb', 'pkg', 'rpm', 'dmg', 'msi', 'sh', 'bash', 'ps1',
  'php', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'cgi', 'htaccess',
  'dll', 'so', 'dylib', 'bin', 'run', 'appimage'
];

/**
 * Sanitize file name to prevent path traversal and injection attacks
 * @param {string} fileName - Original file name
 * @returns {string} Sanitized file name
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid file name');
  }

  // Remove path components
  const baseName = path.basename(fileName);
  
  // Remove null bytes
  let sanitized = baseName.replace(/\0/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Limit length
  sanitized = sanitized.substring(0, 255);
  
  // Ensure it's not empty
  if (!sanitized || sanitized.length === 0) {
    sanitized = `file_${Date.now()}`;
  }
  
  return sanitized;
}

/**
 * Validate file extension
 * @param {string} fileName - File name
 * @returns {string} Extension (lowercase)
 */
function validateFileExtension(fileName) {
  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  
  if (!ext) {
    throw new Error('File must have an extension');
  }
  
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ${ext} is not allowed for security reasons`);
  }
  
  if (!ALLOWED_FILE_TYPES[ext]) {
    throw new Error(`File type ${ext} is not allowed. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`);
  }
  
  return ext;
}

/**
 * Validate file content type against extension
 * @param {string} mimeType - MIME type from request
 * @param {string} extension - File extension
 * @returns {boolean} True if valid
 */
function validateContentType(mimeType, extension) {
  const allowedMimes = ALLOWED_FILE_TYPES[extension];
  if (!allowedMimes) {
    return false;
  }
  
  return allowedMimes.includes(mimeType);
}

/**
 * Validate file signature (magic number)
 * @param {Buffer} buffer - File buffer
 * @param {string} extension - File extension
 * @returns {boolean} True if signature matches
 */
function validateFileSignature(buffer, extension) {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  
  const signature = FILE_SIGNATURES[extension];
  
  // Files without fixed signatures (txt, csv) are allowed if extension is valid
  if (!signature) {
    return true;
  }
  
  // Check if buffer is long enough
  if (buffer.length < signature.length) {
    return false;
  }
  
  // Check signature
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitize string input to prevent injection attacks
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate file upload
 * @param {Object} file - Multer file object
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateFileUpload(file) {
  try {
    // Check if file exists
    if (!file || !file.buffer || !file.originalname) {
      return { valid: false, error: 'Invalid file upload' };
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    // Sanitize file name
    const sanitizedName = sanitizeFileName(file.originalname);
    
    // Validate extension
    const extension = validateFileExtension(sanitizedName);
    
    // Validate content type
    if (!validateContentType(file.mimetype, extension)) {
      return { valid: false, error: `Content type ${file.mimetype} does not match file extension ${extension}` };
    }
    
    // Validate file signature
    if (!validateFileSignature(file.buffer, extension)) {
      return { valid: false, error: `File content does not match expected file type ${extension}` };
    }
    
    // Additional security checks
    // Check for embedded scripts in text files
    if (['txt', 'csv'].includes(extension)) {
      const content = file.buffer.toString('utf-8', 0, Math.min(1000, file.buffer.length));
      // Check for script tags
      if (/<script|javascript:|vbscript:|onload=|onerror=/i.test(content)) {
        return { valid: false, error: 'File contains potentially dangerous content' };
      }
    }
    
    return { valid: true, sanitizedName, extension };
  } catch (error) {
    return { valid: false, error: error.message || 'File validation failed' };
  }
}

/**
 * Validate form data inputs
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateFormData(body) {
  const errors = [];
  
  // Validate title
  if (body.title) {
    const title = sanitizeInput(body.title, 500);
    if (title.length < 1 || title.length > 500) {
      errors.push('Title must be between 1 and 500 characters');
    }
    // Check for dangerous patterns
    if (/<script|javascript:|vbscript:|on\w+=/i.test(title)) {
      errors.push('Title contains potentially dangerous content');
    }
  }
  
  // Validate description
  if (body.description) {
    const description = sanitizeInput(body.description, 5000);
    if (description.length > 5000) {
      errors.push('Description must be less than 5000 characters');
    }
    // Check for dangerous patterns
    if (/<script|javascript:|vbscript:|on\w+=/i.test(description)) {
      errors.push('Description contains potentially dangerous content');
    }
  }
  
  // Validate report_type
  if (body.report_type && !['Weekly', 'Monthly'].includes(body.report_type)) {
    errors.push('Invalid report type');
  }
  
  // Validate region_id and district_id (if provided)
  if (body.region_id && typeof body.region_id === 'string') {
    if (!/^[a-zA-Z0-9_-]+$/.test(body.region_id)) {
      errors.push('Invalid region ID format');
    }
  }
  
  if (body.district_id && typeof body.district_id === 'string') {
    if (!/^[a-zA-Z0-9_-]+$/.test(body.district_id)) {
      errors.push('Invalid district ID format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      title: body.title ? sanitizeInput(body.title, 500) : '',
      description: body.description ? sanitizeInput(body.description, 5000) : '',
      report_type: body.report_type || 'Weekly',
      region_id: body.region_id ? sanitizeInput(body.region_id, 100) : null,
      district_id: body.district_id ? sanitizeInput(body.district_id, 100) : null,
    }
  };
}

module.exports = {
  validateFileUpload,
  validateFormData,
  sanitizeFileName,
  sanitizeInput,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  DANGEROUS_EXTENSIONS
};

