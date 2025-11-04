const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const router = express.Router();

// Configure multer for memory storage with increased file size limit
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Initialize Azure Blob Service Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let blobServiceClient;

console.log('[Photos] Initializing Azure Storage client...');
console.log('[Photos] Connection string exists:', !!connectionString);

if (connectionString) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('[Photos] Azure Storage client initialized successfully');
  } catch (error) {
    console.error('[Photos] Failed to initialize Azure Storage client:', error);
  }
} else {
  console.error('[Photos] AZURE_STORAGE_CONNECTION_STRING not found in environment variables');
}

const containerName = 'uploads';

/**
 * Test endpoint to debug Azure Storage connection and list blobs
 * GET /api/photos/test
 */
router.get('/test', async (req, res) => {
  try {
    console.log('[Photos] Test endpoint called');
    
    if (!blobServiceClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }
    
    console.log(`[Photos] Testing connection to container: ${containerName}`);
    
    // List blobs in the container
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobs = [];
    
    for await (const blob of containerClient.listBlobsFlat()) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        contentType: blob.properties.contentType,
        lastModified: blob.properties.lastModified
      });
    }
    
    console.log(`[Photos] Found ${blobs.length} blobs in container`);
    
    res.json({
      success: true,
      container: containerName,
      blobCount: blobs.length,
      blobs: blobs.slice(0, 10), // Show first 10 blobs
      message: 'Azure Storage connection successful'
    });
    
  } catch (error) {
    console.error('[Photos] Test endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Upload photo from base64 data (NO AUTH REQUIRED)
 * POST /api/photos/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { base64Data, assetId, photoType = 'photo' } = req.body;

    if (!blobServiceClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }

    if (!base64Data || !assetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: base64Data, assetId' 
      });
    }

    // Remove data URL prefix if present
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');
    
    // Generate blob name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[TZ]/g, '-');
    const uniqueId = Date.now();
    let blobName;
    
    console.log(`[Photos] Processing upload:`, { assetId, photoType, timestamp });
    
    if (photoType === 'overhead-inspection') {
      blobName = `overhead-inspections/${assetId}/images[${uniqueId}]-${timestamp}.jpg`;
    } else if (photoType === 'vit-asset') {
      blobName = `vit-assets/${assetId}/images[${uniqueId}]-${timestamp}.jpg`;
    } else if (photoType === 'substation-inspection') {
      blobName = `substation-inspections/${assetId}/images[${uniqueId}]-${timestamp}.jpg`;
    } else {
      blobName = `photos/${assetId}/images[${uniqueId}]-${timestamp}.jpg`;
    }
    
    console.log(`[Photos] Using blob name:`, blobName);
    
    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload to blob storage
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg',
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });
    
    // Generate public URL
    const publicUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;
    
    console.log(`[Photos] Upload successful:`, publicUrl);
    
    res.json({
      success: true,
      url: publicUrl,
      blobName: blobName
    });
    
  } catch (error) {
    console.error('[Photos] Error uploading photo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload photo'
    });
  }
});

/**
 * Upload photo from file (NO AUTH REQUIRED)
 * POST /api/photos/upload-file
 */
router.post('/upload-file', upload.single('photo'), async (req, res) => {
  try {
    const { assetId, photoType = 'photo' } = req.body;
    const file = req.file;

    if (!blobServiceClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }

    if (!file || !assetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: photo file, assetId' 
      });
    }

    // Generate blob name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[TZ]/g, '-');
    const uniqueId = Date.now();
    const extension = file.originalname.split('.').pop() || 'jpg';
    let blobName;
    
    if (photoType === 'overhead-inspection') {
      blobName = `overhead-inspections/${assetId}/images[${uniqueId}]-${timestamp}.${extension}`;
    } else if (photoType === 'vit-asset') {
      blobName = `vit-assets/${assetId}/images[${uniqueId}]-${timestamp}.${extension}`;
    } else if (photoType === 'substation-inspection') {
      blobName = `substation-inspections/${assetId}/images[${uniqueId}]-${timestamp}.${extension}`;
    } else {
      blobName = `photos/${assetId}/images[${uniqueId}]-${timestamp}.${extension}`;
    }
    
    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload to blob storage
    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || 'image/jpeg',
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });
    
    // Generate public URL
    const publicUrl = `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${blobName}`;
    
    res.json({
      success: true,
      url: publicUrl,
      blobName: blobName
    });
    
  } catch (error) {
    console.error('[Photos] Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

/**
 * Serve image from blob storage (NO AUTH REQUIRED)
 * GET /api/photos/serve/:blobName
 */
router.get('/serve/*', async (req, res) => {
  try {
    let blobName = req.params[0]; // Get the full path after /serve/

    console.log(`[Photos] Serve request received for: ${blobName}`);
    console.log(`[Photos] Full request URL: ${req.originalUrl}`);
    console.log(`[Photos] Request params:`, req.params);

    if (!blobServiceClient) {
      console.error('[Photos] Azure Storage not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }

    if (!blobName) {
      console.error('[Photos] Missing blob name');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing blob name' 
      });
    }

    // Decode the blob name to handle special characters
    blobName = decodeURIComponent(blobName);
    
    console.log(`[Photos] Decoded blob name: ${blobName}`);
    console.log(`[Photos] Container name: ${containerName}`);
    console.log(`[Photos] Full blob path: ${containerName}/${blobName}`);

    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    console.log(`[Photos] Blob client URL: ${blockBlobClient.url}`);
    
    // Check if blob exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      console.log(`[Photos] Blob not found: ${containerName}/${blobName}`);
      return res.status(404).json({
        success: false,
        error: 'Image not found',
        details: {
          container: containerName,
          blobName: blobName,
          fullPath: `${containerName}/${blobName}`,
          requestUrl: req.originalUrl
        }
      });
    }

    // Get blob properties
    const properties = await blockBlobClient.getProperties();
    
    // Set CORS headers for public access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Cache-Control');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Set appropriate headers
    res.setHeader('Content-Type', properties.contentType || 'image/jpeg');
    res.setHeader('Content-Length', properties.contentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
    // Stream the blob to response
    const downloadResponse = await blockBlobClient.download();
    downloadResponse.readableStreamBody.pipe(res);
    
  } catch (error) {
    console.error('[Photos] Error serving image:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to serve image'
    });
  }
});

/**
 * Handle OPTIONS requests for photo serve endpoint
 * OPTIONS /api/photos/serve/:blobName
 */
router.options('/serve/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

/**
 * Delete photo from blob storage (NO AUTH REQUIRED)
 * DELETE /api/photos/delete
 */
router.delete('/delete', async (req, res) => {
  try {
    const { photoUrl } = req.body;

    if (!blobServiceClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }

    if (!photoUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing photoUrl' 
      });
    }

    // Extract blob name from URL
    const url = new URL(photoUrl);
    const pathParts = url.pathname.split('/');
    const blobName = pathParts.slice(2).join('/'); // Skip account and container
    
    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Delete the blob
    await blockBlobClient.delete();
    
    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
    
  } catch (error) {
    console.error('[Photos] Error deleting photo:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete photo'
    });
  }
});

module.exports = router; 