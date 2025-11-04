const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'targets';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

// Helper function to ensure targets container exists
async function ensureTargetsContainer() {
  try {
    const { container } = await database.containers.createIfNotExists({
      id: containerId,
      partitionKey: {
        paths: ['/id']
      }
    });
    return container;
  } catch (error) {
    console.error('[Targets] Error ensuring container exists:', error);
    throw error;
  }
}

// Get container, ensuring it exists first
async function getContainer() {
  return await ensureTargetsContainer();
}

/**
 * Target Management & Performance Tracking Routes
 * 
 * Target Types:
 * - loadMonitoring: Count of load monitoring records
 * - substationInspection: Count of substation inspections
 * - overheadLine: Feeder Length in km (calculated from GPS coordinates)
 */

// GET all targets with filtering
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']), async (req, res) => {
  try {
    console.log('[Targets] GET request received:', {
      query: req.query,
      user: req.user?.id,
      role: req.user?.role
    });

    let queryStr = 'SELECT * FROM c';
    const filters = [];

    // Apply role-based filtering
    if (req.user?.role === 'regional_engineer' || req.user?.role === 'regional_general_manager') {
      if (req.user?.region) {
        try {
          // Find regionId from region name
          const regionsContainer = database.container('regions');
          const { resources: regions } = await regionsContainer.items.query(
            `SELECT * FROM c WHERE c.name = "${req.user.region}"`
          ).fetchAll();
          
          if (regions.length > 0) {
            filters.push(`c.regionId = "${regions[0].id}"`);
          }
        } catch (regionErr) {
          console.warn('[Targets] Error fetching region for filtering:', regionErr);
          // Continue without region filter
        }
      }
    }

    // Filter by region if provided
    if (req.query.regionId && req.query.regionId !== 'all') {
      filters.push(`c.regionId = "${req.query.regionId}"`);
    }

    // Filter by district if provided
    if (req.query.districtId && req.query.districtId !== 'all') {
      filters.push(`c.districtId = "${req.query.districtId}"`);
    }

    // Filter by month if provided
    if (req.query.month) {
      filters.push(`c.month = "${req.query.month}"`);
    }

    // Filter by target type if provided
    if (req.query.targetType) {
      filters.push(`c.targetType = "${req.query.targetType}"`);
    }

    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
    }

    // Add sorting - handle case where createdAt might not exist
    // Cosmos DB ORDER BY requires the fields to be indexed or we need to handle it client-side
    // For now, just order by month DESC, and we'll sort client-side if needed
    try {
      queryStr += ' ORDER BY c.month DESC';
    } catch (sortErr) {
      console.warn('[Targets] Order by clause might have issues, continuing without it');
    }

    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 50; // Default 50 per page
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Validate and cap limit to prevent performance issues
    const maxLimit = 1000; // Maximum limit to prevent excessive memory usage
    const finalLimit = Math.min(limit, maxLimit);
    
    // Performance warning for large queries
    if (limit > 500) {
      console.warn('[Targets] Large query requested:', {
        requestedLimit: limit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }
    
    console.log('[Targets] Pagination params:', {
      requestedLimit: limit,
      finalLimit,
      offset,
      countOnly
    });

    console.log('[Targets] Query:', queryStr);
    
    // Ensure container exists
    let container;
    try {
      container = await getContainer();
      console.log('[Targets] Container ready');
    } catch (containerErr) {
      console.error('[Targets] Error getting container:', containerErr);
      // If container doesn't exist, return empty array instead of error
      console.log('[Targets] Container not found, returning empty array');
      return res.json([]);
    }

    try {
      // Count-only shortcut for better performance
      if (countOnly) {
        const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
        const { resources: countResources } = await container.items.query(countQuery).fetchAll();
        const totalCount = countResources[0] ?? 0;
        console.log('[Targets] Count query result:', totalCount);
        return res.json({ total: totalCount });
      }

      // Add pagination to query
      queryStr += ` OFFSET ${offset} LIMIT ${finalLimit}`;
      
      const { resources } = await container.items.query(queryStr).fetchAll();
      console.log('[Targets] Found targets:', resources.length, 'out of potential', limit, 'requested');
      if (resources.length > 0) {
        console.log('[Targets] Sample target:', JSON.stringify(resources[0], null, 2));
      }
      res.json(resources || []);
    } catch (queryErr) {
      console.error('[Targets] Error executing query:', queryErr);
      console.error('[Targets] Error details:', {
        message: queryErr.message,
        code: queryErr.code,
        stack: queryErr.stack
      });
      console.error('[Targets] Query was:', queryStr);
      // Return empty array on query error rather than crashing
      return res.json([]);
    }
  } catch (err) {
    console.error('[Targets] GET error:', err);
    console.error('[Targets] Error stack:', err.stack);
    res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET target by ID
router.get('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const container = await getContainer();
    const { resource } = await container.item(id, id).read();
    
    if (!resource) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json(resource);
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Target not found' });
    }
    console.error('[Targets] GET by ID error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET target for specific region and month
router.get('/region/:regionId/month/:month', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'regional_general_manager']), async (req, res) => {
  try {
    const { regionId, month } = req.params;
    const targetType = req.query.targetType || 'all'; // Default to all types

    let queryStr = `SELECT * FROM c WHERE c.regionId = "${regionId}" AND c.month = "${month}"`;
    
    if (targetType !== 'all') {
      queryStr += ` AND c.targetType = "${targetType}"`;
    }

    const container = await getContainer();
    const { resources } = await container.items.query(queryStr).fetchAll();
    
    res.json(resources);
  } catch (err) {
    console.error('[Targets] GET by region/month error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create or update target (Admin and Global Engineer only)
router.post('/', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    console.log('[Targets] POST request received:', req.body);

    const { regionId, districtId, month, targetType, targetValue, createdBy } = req.body;

    // Validation
    if (!regionId || !month || !targetType || targetValue === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: regionId, month, targetType, and targetValue are required' 
      });
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
    }

    // Validate target type
    const validTargetTypes = ['loadMonitoring', 'substationInspection', 'overheadLine'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ 
        error: `Invalid targetType. Must be one of: ${validTargetTypes.join(', ')}` 
      });
    }

    // Validate target value - handle both string and number
    const numValue = typeof targetValue === 'string' ? parseFloat(targetValue) : Number(targetValue);
    if (isNaN(numValue) || numValue < 0) {
      return res.status(400).json({ error: 'targetValue must be a non-negative number' });
    }

    // Normalize districtId - empty string, null, undefined all become null
    const normalizedDistrictId = (districtId && districtId.trim() !== '' && districtId !== '__all__') ? districtId : null;

    // Ensure container exists
    let container;
    try {
      container = await getContainer();
      console.log('[Targets] Container ready');
    } catch (containerErr) {
      console.error('[Targets] Error getting container:', containerErr);
      return res.status(500).json({ 
        error: 'Failed to access targets container',
        details: containerErr.message 
      });
    }

    // Check if target already exists for this region/month/type
    let existing = [];
    try {
      let existingQuery = `SELECT * FROM c WHERE c.regionId = "${regionId}" AND c.month = "${month}" AND c.targetType = "${targetType}"`;
      if (normalizedDistrictId) {
        existingQuery += ` AND c.districtId = "${normalizedDistrictId}"`;
      } else {
        existingQuery += ` AND (NOT IS_DEFINED(c.districtId) OR c.districtId = null OR c.districtId = "")`;
      }
      
      console.log('[Targets] Checking for existing target with query:', existingQuery);
      const { resources } = await container.items.query(existingQuery).fetchAll();
      existing = resources;
      console.log('[Targets] Found existing targets:', existing.length);
    } catch (queryErr) {
      console.error('[Targets] Error querying existing targets:', queryErr);
      // Continue - will create new target
    }

    // Get user name for createdBy field - prefer name over ID
    let createdByName = createdBy; // Use provided createdBy if specified
    if (!createdByName || createdByName === 'system') {
      // Try to get user name from req.user
      createdByName = req.user?.name || 
                      req.user?.displayName || 
                      req.user?.email?.split('@')[0] ||
                      req.userId || 
                      req.user?.id || 
                      'system';
    }

    const targetData = {
      id: existing.length > 0 ? existing[0].id : undefined, // Use existing ID for update
      regionId,
      districtId: normalizedDistrictId,
      month,
      targetType,
      targetValue: numValue,
      createdBy: createdByName,
      createdAt: existing.length > 0 ? existing[0].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let result;
    try {
      if (existing.length > 0) {
        // Update existing target
        console.log('[Targets] Updating existing target:', existing[0].id);
        const { resource } = await container.item(existing[0].id, existing[0].id).replace(targetData);
        result = resource;
        console.log('[Targets] Updated existing target:', result.id);
      } else {
        // Create new target
        // Generate ID if not provided - use a simpler format
        if (!targetData.id) {
          const idParts = [regionId, month, targetType];
          if (normalizedDistrictId) {
            idParts.push(normalizedDistrictId);
          }
          targetData.id = idParts.join('-') + '-' + Date.now();
          // Clean ID to ensure it's valid for Cosmos DB
          targetData.id = targetData.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        console.log('[Targets] Creating new target with ID:', targetData.id);
        console.log('[Targets] Target data:', JSON.stringify(targetData, null, 2));
        const { resource } = await container.items.create(targetData);
        result = resource;
        console.log('[Targets] Created new target:', result.id);
      }

      res.status(existing.length > 0 ? 200 : 201).json(result);
    } catch (createErr) {
      console.error('[Targets] Error creating/updating target:', createErr);
      console.error('[Targets] Error details:', {
        message: createErr.message,
        code: createErr.code,
        stack: createErr.stack
      });
      return res.status(500).json({ 
        error: 'Failed to save target',
        details: createErr.message,
        code: createErr.code
      });
    }
  } catch (err) {
    console.error('[Targets] POST error:', err);
    console.error('[Targets] Error stack:', err.stack);
    res.status(500).json({ 
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// PUT update target (Admin and Global Engineer only)
router.put('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    const container = await getContainer();
    
    // Read existing target
    const { resource: existing } = await container.item(id, id).read();
    
    if (!existing) {
      return res.status(404).json({ error: 'Target not found' });
    }

    // Merge with new data
    const updated = {
      ...existing,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Validate target value if provided
    if (updated.targetValue !== undefined && (typeof updated.targetValue !== 'number' || updated.targetValue < 0)) {
      return res.status(400).json({ error: 'targetValue must be a non-negative number' });
    }

    const { resource } = await container.item(id, id).replace(updated);
    
    console.log('[Targets] Updated target:', id);
    res.json(resource);
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Target not found' });
    }
    console.error('[Targets] PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE target (Admin and Global Engineer only)
router.delete('/:id', requireAuth(), requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    const container = await getContainer();
    await container.item(id, id).delete();
    
    console.log('[Targets] Deleted target:', id);
    res.json({ message: 'Target deleted successfully', id });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ error: 'Target not found' });
    }
    console.error('[Targets] DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

