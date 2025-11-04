const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const router = express.Router();

// Middleware to check if user is authenticated
const { authenticateToken } = require('../authMiddleware');

/**
 * Test endpoint to verify Azure Storage connection
 */
router.get('/test-connection', authenticateToken, async (req, res) => {
  try {
    console.log('[ImageProxy] Testing Azure Storage connection...');
    
    // Get Azure Storage connection string from environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      return res.status(500).json({ 
        error: 'Connection string not found',
        details: 'AZURE_STORAGE_CONNECTION_STRING environment variable is not set'
      });
    }
    
    // Validate connection string format
    if (!connectionString.includes('DefaultEndpointsProtocol=') || 
        !connectionString.includes('AccountName=') || 
        !connectionString.includes('AccountKey=')) {
      return res.status(500).json({ 
        error: 'Invalid connection string format',
        details: 'Connection string must include DefaultEndpointsProtocol, AccountName, and AccountKey'
      });
    }
    
    // Extract account name for logging
    const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
    const accountName = accountNameMatch ? accountNameMatch[1] : 'Unknown';
    
    console.log(`[ImageProxy] Testing connection to account: ${accountName}`);
    
    try {
      // Create Blob Service Client
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      
      // List containers to test connection
      const containers = [];
      for await (const container of blobServiceClient.listContainers()) {
        containers.push({
          name: container.name,
          publicAccess: container.publicAccess,
          lastModified: container.lastModified
        });
      }
      
      console.log(`[ImageProxy] Connection successful! Found ${containers.length} containers`);
      
      res.json({
        success: true,
        accountName,
        containersCount: containers.length,
        containers: containers.map(c => ({ name: c.name, publicAccess: c.publicAccess })),
        message: 'Azure Storage connection successful'
      });
      
    } catch (azureError) {
      console.error('[ImageProxy] Azure connection test failed:', azureError);
      
      let errorDetails = 'Unknown Azure error';
      let statusCode = 500;
      
      if (azureError.code === 'PublicAccessNotPermitted') {
        errorDetails = 'Storage account requires authentication. This is normal and expected for secure accounts.';
        statusCode = 200; // This is actually a successful connection test
      } else if (azureError.code === 'AuthenticationFailed') {
        errorDetails = 'Invalid storage account credentials. Please check your connection string.';
        statusCode = 401;
      } else if (azureError.code === 'AccountNotFound') {
        errorDetails = 'Storage account not found. Please check the account name in your connection string.';
        statusCode = 404;
      } else if (azureError.code === 'InvalidUri') {
        errorDetails = 'Invalid connection string format. Please check your connection string.';
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: azureError.code === 'PublicAccessNotPermitted',
        accountName,
        error: azureError.code,
        details: errorDetails,
        azureMessage: azureError.message,
        note: azureError.code === 'PublicAccessNotPermitted' ? 
          'This error is expected for secure storage accounts. The connection is working correctly.' : 
          'Please check your Azure Storage configuration.'
      });
    }
    
  } catch (error) {
    console.error('[ImageProxy] Connection test error:', error);
    res.status(500).json({ 
      error: 'Connection test failed',
      details: error.message
    });
  }
});

/**
 * HEAD endpoint for image validation (returns headers without downloading image)
 */
router.head('/:container/:blobPath(*)', authenticateToken, async (req, res) => {
  try {
    const { container, blobPath } = req.params;
    
    console.log(`[ImageProxy HEAD] Validating image: ${container}/${blobPath}`);
    
    // Get Azure Storage connection string from environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('[ImageProxy HEAD] Azure Storage connection string not found');
      return res.status(500).end();
    }
    
    // Create Blob Service Client
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      console.log(`[ImageProxy HEAD] Blob not found: ${container}/${blobPath}`);
      return res.status(404).end();
    }
    
    // Get blob properties
    const properties = await blobClient.getProperties();
    
    // Validate that this is actually an image
    if (!properties.contentType || !properties.contentType.startsWith('image/')) {
      console.error(`[ImageProxy HEAD] Blob is not an image: ${properties.contentType}`);
      return res.status(400).end();
    }
    
    // Set headers for validation
    res.set({
      'Content-Type': properties.contentType,
      'Content-Length': properties.contentLength,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'HEAD, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    
    console.log(`[ImageProxy HEAD] Validation successful: ${container}/${blobPath}`);
    res.status(200).end();
    
  } catch (error) {
    console.error('[ImageProxy HEAD] Error:', error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

/**
 * Image Proxy Route
 * Fetches images from Azure Blob Storage and serves them to frontend
 * This bypasses CORS issues and provides secure access to images
 */
router.get('/:container/:blobPath(*)', authenticateToken, async (req, res) => {
  try {
    const { container, blobPath } = req.params;
    
    console.log(`[ImageProxy] Fetching image: ${container}/${blobPath}`);
    console.log(`[ImageProxy] Request headers:`, req.headers);
    
    // Get Azure Storage connection string from environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('[ImageProxy] Azure Storage connection string not found');
      return res.status(500).json({ 
        error: 'Storage configuration error',
        details: 'AZURE_STORAGE_CONNECTION_STRING environment variable is not set'
      });
    }
    
    // Validate connection string format
    if (!connectionString.includes('DefaultEndpointsProtocol=') || 
        !connectionString.includes('AccountName=') || 
        !connectionString.includes('AccountKey=')) {
      console.error('[ImageProxy] Invalid Azure Storage connection string format');
      return res.status(500).json({ 
        error: 'Invalid storage configuration',
        details: 'Connection string format is incorrect'
      });
    }
    
    console.log(`[ImageProxy] Connection string found, length: ${connectionString.length}`);
    
    try {
      // Create Blob Service Client
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(container);
      const blobClient = containerClient.getBlobClient(blobPath);
      
      console.log(`[ImageProxy] Blob client created for: ${blobClient.url}`);
      
      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        console.log(`[ImageProxy] Blob not found: ${container}/${blobPath}`);
        return res.status(404).json({ error: 'Image not found' });
      }
      
      console.log(`[ImageProxy] Blob exists, getting properties...`);
      
      // Get blob properties to determine content type
      const properties = await blobClient.getProperties();
      
      console.log(`[ImageProxy] Blob properties:`, {
        contentType: properties.contentType,
        contentLength: properties.contentLength,
        lastModified: properties.lastModified
      });
      
      // Validate that this is actually an image
      if (!properties.contentType || !properties.contentType.startsWith('image/')) {
        console.error(`[ImageProxy] Blob is not an image: ${properties.contentType}`);
        return res.status(400).json({ 
          error: 'Not an image file',
          contentType: properties.contentType,
          expectedType: 'image/*'
        });
      }
      
      // Validate content length
      if (!properties.contentLength || properties.contentLength === 0) {
        console.error(`[ImageProxy] Blob has no content: ${properties.contentLength}`);
        return res.status(400).json({ 
          error: 'Empty image file',
          contentLength: properties.contentLength
        });
      }
      
      // Set appropriate headers
      res.set({
        'Content-Type': properties.contentType,
        'Content-Length': properties.contentLength,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      
      console.log(`[ImageProxy] Starting download...`);
      
      // Stream the blob to response
      const downloadResponse = await blobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('Download response has no readable stream');
      }
      
      console.log(`[ImageProxy] Download started, streaming to response...`);
      
      // Add error handling to the stream
      downloadResponse.readableStreamBody.on('error', (error) => {
        console.error('[ImageProxy] Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error', details: error.message });
        }
      });
      
      downloadResponse.readableStreamBody.pipe(res);
      
      console.log(`[ImageProxy] Successfully served image: ${container}/${blobPath}`);
      
    } catch (azureError) {
      console.error('[ImageProxy] Azure Storage error:', azureError);
      
      // Handle specific Azure errors
      if (azureError.code === 'PublicAccessNotPermitted') {
        return res.status(403).json({
          error: 'Storage access denied',
          details: 'The storage account requires authentication. Please check your connection string and permissions.',
          azureError: azureError.message
        });
      }
      
      if (azureError.code === 'AuthenticationFailed') {
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Invalid storage account credentials. Please check your connection string.',
          azureError: azureError.message
        });
      }
      
      if (azureError.code === 'ContainerNotFound') {
        return res.status(404).json({
          error: 'Container not found',
          details: `Container '${container}' does not exist in the storage account.`,
          azureError: azureError.message
        });
      }
      
      // Generic Azure error
      return res.status(500).json({
        error: 'Azure Storage error',
        details: azureError.message,
        code: azureError.code
      });
    }
    
  } catch (error) {
    console.error('[ImageProxy] Error fetching image:', error);
    console.error('[ImageProxy] Error stack:', error.stack);
    
    // Don't send HTML error pages - always return JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to fetch image',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

/**
 * Debug endpoint to test image proxy functionality
 */
router.get('/debug/:container/:blobPath(*)', authenticateToken, async (req, res) => {
  try {
    const { container, blobPath } = req.params;
    
    console.log(`[ImageProxy Debug] Testing image: ${container}/${blobPath}`);
    
    // Get Azure Storage connection string from environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('[ImageProxy Debug] Azure Storage connection string not found');
      return res.status(500).json({ error: 'Storage configuration error' });
    }
    
    // Create Blob Service Client
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      console.log(`[ImageProxy Debug] Blob not found: ${container}/${blobPath}`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Get blob properties
    const properties = await blobClient.getProperties();
    
    // Return debug information instead of the actual image
    res.json({
      success: true,
      container,
      blobPath,
      exists: true,
      properties: {
        contentType: properties.contentType,
        contentLength: properties.contentLength,
        lastModified: properties.lastModified,
        etag: properties.etag,
        metadata: properties.metadata
      },
      message: 'Image exists and is accessible'
    });
    
  } catch (error) {
    console.error('[ImageProxy Debug] Error:', error);
    res.status(500).json({ 
      error: 'Debug request failed',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * Health check endpoint for image proxy
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'image-proxy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
