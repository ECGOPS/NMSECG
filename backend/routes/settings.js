const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const { getContainer, ensureContainerExists } = require('../cosmosClient');
const { requireRole } = require('../roles');
const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for background images
  }
});

// Initialize Azure Blob Service Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let blobServiceClient;

if (connectionString) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    console.log('[Settings] Azure Storage client initialized successfully');
  } catch (error) {
    console.error('[Settings] Failed to initialize Azure Storage client:', error);
  }
}

const containerName = 'uploads';
const SETTINGS_CONTAINER = 'settings';
const LOGIN_BACKGROUND_KEY = 'loginBackground';

/**
 * Get login background settings
 * GET /api/settings/login-background
 */
router.get('/login-background', async (req, res) => {
  try {
    // Ensure container exists before using it
    await ensureContainerExists(SETTINGS_CONTAINER);
    const container = getContainer(SETTINGS_CONTAINER);
    
    // Try to get existing settings
    try {
      const { resource: settings } = await container.item(LOGIN_BACKGROUND_KEY, LOGIN_BACKGROUND_KEY).read();
      console.log('[Settings] Retrieved login background settings:', {
        id: settings.id,
        backgroundUrl: settings.backgroundUrl,
        uploadedAt: settings.uploadedAt
      });
      
      // Set cache headers for faster loading (24 hours)
      // Include timestamp only for cache validation, not for cache-busting existing images
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('ETag', `"${settings.uploadedAt || settings.id}"`); // Use uploadedAt as ETag for cache validation
      
      res.json({
        success: true,
        backgroundUrl: settings.backgroundUrl || null,
        fallbackUrl: '/images/ops.png', // Default fallback
        uploadedAt: settings.uploadedAt || null // Include timestamp to detect new uploads
      });
    } catch (error) {
      // If not found (404), return null with fallback - this is expected for first-time use
      if (error.code === 404 || error.code === 'NotFound') {
        console.log('[Settings] Login background not found, returning default');
        // Cache the "no background" response for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        res.json({
          success: true,
          backgroundUrl: null,
          fallbackUrl: '/images/ops.png'
        });
      } else {
        // Log other errors but still return a safe fallback
        console.error('[Settings] Error reading login background:', error);
        // Return success with null to allow page to load with default
        // Cache errors for shorter time (15 minutes)
        res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
        res.json({
          success: true,
          backgroundUrl: null,
          fallbackUrl: '/images/ops.png'
        });
      }
    }
  } catch (error) {
    console.error('[Settings] Error getting login background:', error);
    // Always return success with fallback to prevent login page from breaking
    // Don't cache errors for long (5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.json({
      success: true,
      backgroundUrl: null,
      fallbackUrl: '/images/ops.png'
    });
  }
});

/**
 * Upload login background image
 * POST /api/settings/login-background/upload
 * Requires authentication and admin role (same as broadcast messages)
 */
router.post('/login-background/upload', requireRole(['system_admin', 'global_engineer']), upload.single('background'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' 
      });
    }

    if (!blobServiceClient) {
      return res.status(500).json({ 
        success: false, 
        error: 'Azure Storage not configured' 
      });
    }

    // Generate blob name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[TZ]/g, '-');
    const extension = file.originalname.split('.').pop() || 'jpg';
    const blobName = `login-backgrounds/login-bg-${timestamp}.${extension}`;
    
    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload to blob storage
    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000' // Cache for 1 year
      }
    });
    
    // Generate public URL (using proxy endpoint for security)
    const publicUrl = `/api/photos/serve/${blobName}`;
    
    // Save settings to database (ensure container exists first)
    await ensureContainerExists(SETTINGS_CONTAINER);
    const container = getContainer(SETTINGS_CONTAINER);
    const settings = {
      id: LOGIN_BACKGROUND_KEY,
      backgroundUrl: publicUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.userId || req.user?.uid || req.user?.id || 'unknown'
    };
    
    await container.items.upsert(settings);
    
    // Invalidate any existing cache by returning a timestamp
    res.json({
      success: true,
      url: publicUrl,
      timestamp: new Date().toISOString(), // Include timestamp for cache busting
      message: 'Login background uploaded successfully'
    });
    
  } catch (error) {
    console.error('[Settings] Error uploading login background:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload login background'
    });
  }
});

/**
 * Delete login background (reset to default)
 * DELETE /api/settings/login-background
 * Requires authentication and admin role (same as broadcast messages)
 */
router.delete('/login-background', requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    // Ensure container exists before using it
    await ensureContainerExists(SETTINGS_CONTAINER);
    const container = getContainer(SETTINGS_CONTAINER);
    
    // Delete settings
    try {
      await container.item(LOGIN_BACKGROUND_KEY, LOGIN_BACKGROUND_KEY).delete();
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }
    }
    
    res.json({
      success: true,
      message: 'Login background reset to default'
    });
    
  } catch (error) {
    console.error('[Settings] Error deleting login background:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete login background settings'
    });
  }
});

module.exports = router;
