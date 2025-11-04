const express = require('express');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireRole, requireAuth } = require('../roles');
const { validateFileUpload, validateFormData, sanitizeFileName, MAX_FILE_SIZE } = require('../middleware/fileUploadSecurity');
// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'reports';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

// Configure multer for memory storage with security limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE, // 100MB limit
    files: 1, // Only one file per request
    fields: 10, // Maximum 10 form fields
    fieldNameSize: 100, // Maximum field name length
    fieldSize: 1024 * 1024, // 1MB max per field
  },
  fileFilter: (req, file, cb) => {
    // Basic validation - detailed validation happens after upload
    try {
      const sanitizedName = sanitizeFileName(file.originalname);
      cb(null, true);
    } catch (error) {
      cb(new Error(`Invalid file name: ${error.message}`), false);
    }
  }
});

// Rate limiting for uploads (prevent abuse)
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: 'Too many upload requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development' && process.env.TEST_JWT !== 'true';
  }
});

// Initialize Azure Blob Service Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let blobServiceClient;
const blobContainerName = 'uploads';

if (connectionString) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('[Reports] Azure Storage client initialized successfully');
  } catch (error) {
    console.error('[Reports] Failed to initialize Azure Storage client:', error);
  }
}

/**
 * Helper function to ensure reports container exists
 */
async function ensureReportsContainer() {
  try {
    console.log('[Reports] Ensuring container exists:', containerId);
    const { container, created } = await database.containers.createIfNotExists({
      id: containerId,
      partitionKey: {
        paths: ['/id']
      }
    });
    if (created) {
      console.log('[Reports] ✅ Container created successfully:', containerId);
    } else {
      console.log('[Reports] ✅ Container already exists:', containerId);
    }
    return container;
  } catch (error) {
    console.error('[Reports] ❌ Error ensuring container exists:', error);
    console.error('[Reports] Error details:', {
      code: error.code,
      message: error.message,
      containerId: containerId
    });
    throw error;
  }
}

/**
 * Get container, ensuring it exists first
 * Same pattern as targets.js - simply returns the container from ensureReportsContainer
 */
async function getContainer() {
  return await ensureReportsContainer();
}

/**
 * Upload file to Azure Blob Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Sanitized file name
 * @param {string} contentType - File content type
 * @param {Object} fileValidation - File validation result
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadToBlobStorage(fileBuffer, fileName, contentType, fileValidation = null) {
  console.log('[Reports] uploadToBlobStorage called');
  console.log('[Reports] Blob service client:', blobServiceClient ? 'Initialized' : 'NOT INITIALIZED');
  
  if (!blobServiceClient) {
    console.error('[Reports] Azure Blob Storage not configured - connection string missing');
    throw new Error('Azure Blob Storage not configured');
  }

  try {
    console.log('[Reports] Getting blob container client:', blobContainerName);
    const containerClient = blobServiceClient.getContainerClient(blobContainerName);
    
    // Ensure container exists (without public access)
    console.log('[Reports] Ensuring blob container exists...');
    const containerResult = await containerClient.createIfNotExists();
    console.log('[Reports] Blob container ready:', containerResult.created ? 'Created' : 'Already exists');

    // Generate unique blob name with timestamp (use already sanitized name from validation)
    const timestamp = Date.now();
    let sanitizedFileName = fileName;
    let extension = path.extname(fileName).replace('.', '').toLowerCase();
    
    if (fileValidation && fileValidation.sanitizedName) {
      sanitizedFileName = fileValidation.sanitizedName;
      if (fileValidation.extension) {
        extension = fileValidation.extension;
      }
    } else {
      sanitizedFileName = sanitizeFileName(fileName);
    }
    
    // Ensure extension is added if missing
    if (!sanitizedFileName.toLowerCase().endsWith(`.${extension}`)) {
      sanitizedFileName = `${sanitizedFileName.replace(/\.\w+$/i, '')}.${extension}`;
    }
    
    const blobName = `reports/${timestamp}-${generateId()}-${sanitizedFileName}`;
    
    console.log('[Reports] Creating block blob client for:', blobName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload file
    console.log('[Reports] Uploading file to blob storage...');
    console.log('[Reports] File size:', fileBuffer.length, 'bytes');
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || 'application/octet-stream'
      }
    });

    // Generate SAS URL for secure access (valid for 1 year)
    console.log('[Reports] Generating SAS URL for secure access...');
    const expiresOn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
    
    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'), // Read permission only
      expiresOn: expiresOn
    });
    
    console.log('[Reports] ✅ File uploaded successfully to blob storage');
    console.log('[Reports] SAS URL generated (valid for 1 year)');
    return sasUrl;
  } catch (error) {
    console.error('[Reports] ❌ Error uploading to blob storage:', error);
    console.error('[Reports] Blob upload error details:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500)
    });
    throw error;
  }
}

/**
 * Get week number from date
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get month in YYYY-MM format
 */
function getMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get user's region and district from JWT
 */
function getUserRegionAndDistrict(req) {
  const user = req.user || {};
  return {
    id: user.id || user.uid || user.sub || null,
    uid: user.uid || user.id || user.sub || null,
    email: user.email || user['https://ecg.com/email'] || null,
    name: user.name || user.displayName || user['https://ecg.com/name'] || null,
    displayName: user.displayName || user.name || user['https://ecg.com/name'] || null,
    region: user.region || user['https://ecg.com/region'] || null,
    district: user.district || user['https://ecg.com/district'] || null,
    role: user.role || user['https://ecg.com/role'] || null
  };
}

/**
 * POST /api/reports
 * Upload a new report
 * 
 * Request: multipart/form-data
 * - file: File to upload
 * - title: Report title
 * - description: Report description
 * - report_type: "Weekly" or "Monthly"
 * - region_id: Region ID (optional, auto-filled for non-admin)
 * - district_id: District ID (optional, auto-filled for district users)
 * 
 * Security measures:
 * - Rate limiting (10 uploads per 15 minutes)
 * - File type validation (whitelist)
 * - File signature validation (magic numbers)
 * - File name sanitization
 * - Input sanitization
 * - Content type validation
 */
// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('[Reports] Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB' });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed' });
    } else if (err.code === 'LIMIT_FIELD_COUNT') {
      return res.status(400).json({ error: 'Too many form fields' });
    } else if (err.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({ error: 'Field value too large' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('[Reports] Upload error:', err);
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  next();
};

router.post('/', requireAuth(), uploadRateLimit, upload.single('file'), handleMulterError, async (req, res) => {
  console.log('[Reports] ==========================================');
  console.log('[Reports] POST /api/reports - Handler called');
  console.log('[Reports] Request method:', req.method);
  console.log('[Reports] Request path:', req.path);
  console.log('[Reports] Has file:', !!req.file);
  if (req.file) {
    console.log('[Reports] File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  }
  console.log('[Reports] ==========================================');
  
  try {
    console.log('[Reports] POST request received');
    console.log('[Reports] User:', req.user?.id || req.user?.email || 'unknown');
    
    if (!req.file) {
      console.error('[Reports] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file upload (comprehensive security check)
    const fileValidation = validateFileUpload(req.file);
    if (!fileValidation.valid) {
      console.error('[Reports] SECURITY: File validation failed:', {
        error: fileValidation.error,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        user: req.user?.id || req.user?.email || 'unknown'
      });
      return res.status(400).json({ error: fileValidation.error });
    }
    
    console.log('[Reports] File validation passed:', {
      fileName: fileValidation.sanitizedName,
      extension: fileValidation.extension,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    // Validate and sanitize form data
    const formValidation = validateFormData(req.body);
    if (!formValidation.valid) {
      console.error('[Reports] SECURITY: Form validation failed:', {
        errors: formValidation.errors,
        user: req.user?.id || req.user?.email || 'unknown'
      });
      return res.status(400).json({ error: formValidation.errors.join(', ') });
    }

    const { title, description, report_type, region_id, district_id } = formValidation.sanitized;

    // Additional validation (already sanitized)
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required and must not be empty' });
    }

    if (!report_type || !['Weekly', 'Monthly'].includes(report_type)) {
      return res.status(400).json({ error: 'report_type must be "Weekly" or "Monthly"' });
    }

    const user = getUserRegionAndDistrict(req);
    
    // Role-based validation
    let finalRegionId = region_id;
    let finalDistrictId = district_id;

    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      // District users can only upload for their own district
      if (!user.district) {
        return res.status(403).json({ error: 'District user must have a district assigned' });
      }
      finalDistrictId = user.district;
      // Get region from district
      try {
        const districtsContainer = database.container('districts');
        const { resources } = await districtsContainer.items.query({
          query: 'SELECT * FROM c WHERE c.id = @districtId',
          parameters: [{ name: '@districtId', value: finalDistrictId }]
        }).fetchAll();
        
        if (resources.length > 0 && resources[0].regionId) {
          finalRegionId = resources[0].regionId;
        }
      } catch (err) {
        console.warn('[Reports] Could not resolve region from district:', err);
      }
    } else if (user.role === 'regional_engineer' || user.role === 'regional_general_manager') {
      // Regional admins can only upload for their region
      if (!user.region) {
        return res.status(403).json({ error: 'Regional admin must have a region assigned' });
      }
      finalRegionId = user.region;
      finalDistrictId = null; // Regional reports don't have a district
    } else if (user.role === 'system_admin' || user.role === 'global_engineer') {
      // Admin can upload for any region/district
      // Use provided region_id and district_id, or null
      finalRegionId = region_id || null;
      finalDistrictId = district_id || null;
    } else {
      return res.status(403).json({ error: 'Insufficient permissions to upload reports' });
    }

    // Upload file to blob storage (use validated file name)
    const fileUrl = await uploadToBlobStorage(
      req.file.buffer,
      fileValidation.sanitizedName || req.file.originalname,
      req.file.mimetype,
      fileValidation
    );

    // Create report document
    const uploadDate = new Date();
    const reportData = {
      id: generateId(),
      region_id: finalRegionId,
      district_id: finalDistrictId,
      uploaded_by: user.id || user.uid || user.email || 'unknown',
      uploaded_by_name: user.name || user.displayName || user.email || 'Unknown',
      role: user.role || 'unknown',
      report_type: report_type,
      title: title.trim(),
      description: description ? description.trim() : '',
      file_url: fileUrl,
      file_name: fileValidation.sanitizedName || sanitizeFileName(req.file.originalname),
      file_size: req.file.size,
      file_type: req.file.mimetype,
      file_extension: fileValidation.extension,
      upload_date: uploadDate.toISOString(),
      week_number: getWeekNumber(uploadDate),
      month: getMonth(uploadDate),
      createdAt: uploadDate.toISOString(),
      updatedAt: uploadDate.toISOString()
    };

    // Save to Cosmos DB
    console.log('[Reports] Getting container...');
    const container = await getContainer();
    console.log('[Reports] Container obtained, creating report item...');
    const { resource } = await container.items.create(reportData);

    console.log('[Reports] ✅ Report created successfully:', resource.id);
    console.log('[Reports] Report data:', {
      id: resource.id,
      title: resource.title,
      report_type: resource.report_type,
      file_name: resource.file_name
    });
    console.log('[Reports] ✅ POST request completed successfully - returning 201');
    res.status(201).json(resource);
  } catch (error) {
    console.error('[Reports] ❌❌❌ POST error:', error);
    console.error('[Reports] Error type:', error.constructor.name);
    console.error('[Reports] Error message:', error.message);
    console.error('[Reports] Error stack:', error.stack);
    console.error('[Reports] Error details:', {
      code: error.code,
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500) // First 500 chars of stack
    });
    
    // Return appropriate error based on error type
    if (error.message?.includes('Azure Blob Storage not configured') || error.message?.includes('Azure Storage')) {
      console.error('[Reports] Azure Blob Storage error');
      return res.status(500).json({ 
        error: 'File storage not configured. Please contact administrator.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.code === 404 || error.message?.includes('Container') || error.message?.includes('NotFound')) {
      console.error('[Reports] Container error');
      return res.status(500).json({ 
        error: 'Database container error. Please contact administrator.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.message?.includes('validation') || error.message?.includes('Validation')) {
      console.error('[Reports] Validation error');
      return res.status(400).json({ 
        error: error.message || 'Validation error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/reports
 * Fetch reports based on role
 * 
 * Query params:
 * - type: "Weekly" or "Monthly" (optional)
 * - month: YYYY-MM format (optional)
 * - region_id: Filter by region (optional)
 * - district_id: Filter by district (optional)
 * - limit: Pagination limit (default: 50)
 * - offset: Pagination offset (default: 0)
 * - countOnly: Return only count (default: false)
 */
router.get('/', requireAuth(), async (req, res) => {
  try {
    console.log('[Reports] GET request received:', req.query);
    console.log('[Reports] User:', req.user?.id || req.user?.email || 'unknown');
    
    const user = getUserRegionAndDistrict(req);
    console.log('[Reports] User role:', user.role);
    
    // Ensure container exists
    let container;
    try {
      console.log('[Reports] Getting container...');
      container = await getContainer();
      console.log('[Reports] ✅ Container ready');
    } catch (containerErr) {
      console.error('[Reports] ❌ Error getting container:', containerErr);
      console.error('[Reports] Container error details:', {
        code: containerErr.code,
        message: containerErr.message,
        stack: containerErr.stack
      });
      // If container doesn't exist, return empty array instead of error
      console.log('[Reports] Container not found, returning empty array');
      return res.json([]);
    }
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];

    // Role-based filtering
    if (user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') {
      // District users see only their district reports
      if (!user.district) {
        return res.json([]);
      }
      filters.push(`c.district_id = "${user.district}"`);
    } else if (user.role === 'regional_engineer' || user.role === 'regional_general_manager') {
      // Regional admins see their region + all districts in their region
      if (!user.region) {
        return res.json([]);
      }
      // Get all districts in the region
      try {
        const districtsContainer = database.container('districts');
        const { resources: districts } = await districtsContainer.items.query(
          `SELECT * FROM c WHERE c.regionId = "${user.region}"`
        ).fetchAll();
        
        const districtIds = districts.map(d => d.id);
        if (districtIds.length > 0) {
          const districtFilters = districtIds.map(id => `c.district_id = "${id}"`).join(' OR ');
          filters.push(`(c.region_id = "${user.region}" OR ${districtFilters})`);
        } else {
          filters.push(`c.region_id = "${user.region}"`);
        }
      } catch (err) {
        console.warn('[Reports] Error fetching districts, using region only:', err);
        filters.push(`c.region_id = "${user.region}"`);
      }
    }
    // Admin and global_engineer see all reports (no filter)

    // Additional filters
    if (req.query.type && ['Weekly', 'Monthly'].includes(req.query.type)) {
      filters.push(`c.report_type = "${req.query.type}"`);
    }

    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      filters.push(`c.month = "${req.query.month}"`);
    }

    if (req.query.region_id) {
      filters.push(`c.region_id = "${req.query.region_id}"`);
    }

    if (req.query.district_id) {
      filters.push(`c.district_id = "${req.query.district_id}"`);
    }

    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
    }

    // Sorting
    queryStr += ' ORDER BY c.upload_date DESC';

    // Pagination
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    const maxLimit = 1000;
    const finalLimit = Math.min(limit, maxLimit);

    // Count-only query
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;
      return res.json({ total: totalCount });
    }

    // Add pagination
    queryStr += ` OFFSET ${offset} LIMIT ${finalLimit}`;

    const { resources } = await container.items.query(queryStr).fetchAll();
    
    // Enrich reports with region and district names
    const enrichedReports = await Promise.all(resources.map(async (report) => {
      const enriched = { ...report };
      
      // Resolve region name
      if (report.region_id) {
        try {
          const regionsContainer = database.container('regions');
          const { resources: regions } = await regionsContainer.items.query(
            `SELECT * FROM c WHERE c.id = "${report.region_id}"`
          ).fetchAll();
          if (regions.length > 0) {
            enriched.region_name = regions[0].name;
          }
        } catch (err) {
          console.warn('[Reports] Error resolving region name:', err);
        }
      }
      
      // Resolve district name
      if (report.district_id) {
        try {
          const districtsContainer = database.container('districts');
          const { resources: districts } = await districtsContainer.items.query(
            `SELECT * FROM c WHERE c.id = "${report.district_id}"`
          ).fetchAll();
          if (districts.length > 0) {
            enriched.district_name = districts[0].name;
          }
        } catch (err) {
          console.warn('[Reports] Error resolving district name:', err);
        }
      }
      
      return enriched;
    }));
    
    console.log('[Reports] Found reports:', enrichedReports.length);
    res.json(enrichedReports);
  } catch (error) {
    console.error('[Reports] GET error:', error);
    console.error('[Reports] Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // If container-related error, return empty array
    if (error.code === 404 || error.message?.includes('NotFound') || error.message?.includes('Container')) {
      console.log('[Reports] Container-related error, returning empty array');
      return res.json([]);
    }
    
    // For other errors, return 500
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report
 * 
 * Only admin or the uploader can delete
 */
router.delete('/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserRegionAndDistrict(req);
    
    const container = await getContainer();

    // Get the report
    let report;
    try {
      const { resource } = await container.item(id, id).read();
      report = resource;
    } catch (error) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check permissions
    const isAdmin = user.role === 'system_admin' || user.role === 'global_engineer';
    const isUploader = report.uploaded_by === user.id || report.uploaded_by === user.uid || report.uploaded_by === user.email;

    if (!isAdmin && !isUploader) {
      return res.status(403).json({ error: 'Insufficient permissions to delete this report' });
    }

    // Delete from Cosmos DB
    await container.item(id, id).delete();

    // Optionally delete from blob storage (commented out for safety)
    // if (report.file_url && blobServiceClient) {
    //   try {
    //     const containerClient = blobServiceClient.getContainerClient(blobContainerName);
    //     const blobName = report.file_url.split('/').slice(-1)[0];
    //     const blockBlobClient = containerClient.getBlockBlobClient(`reports/${blobName}`);
    //     await blockBlobClient.delete();
    //   } catch (blobError) {
    //     console.warn('[Reports] Error deleting blob:', blobError);
    //   }
    // }

    console.log('[Reports] Report deleted:', id);
    res.status(204).end();
  } catch (error) {
    console.error('[Reports] DELETE error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

