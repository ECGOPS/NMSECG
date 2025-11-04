const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'broadcastMessages';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    // For development, return empty array if database is not configured
    if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
      console.log('Development mode: returning empty broadcast messages array');
      return res.json([]);
    }
    
    const { active } = req.query;
    let query = 'SELECT * FROM c';
    
    // Filter by active status if provided
    if (active === 'true') {
      query = 'SELECT * FROM c WHERE c.active = true';
    } else if (active === 'false') {
      query = 'SELECT * FROM c WHERE c.active = false';
    }
    
    query += ' ORDER BY c.createdAt DESC';
    
    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 50; // Default 50 per page
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Validate and cap limit to prevent performance issues
    const maxLimit = 1000; // Maximum limit to prevent excessive memory usage
    const finalLimit = Math.min(limit, maxLimit);
    
    // Performance warning for large queries
    if (limit > 500) {
      console.warn('[BroadcastMessages] Large query requested:', {
        requestedLimit: limit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }
    
    console.log('[BroadcastMessages] Pagination params:', {
      requestedLimit: limit,
      finalLimit,
      offset,
      countOnly
    });

    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = query.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;
      console.log('[BroadcastMessages] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }
    
    // Add pagination to query
    query += ` OFFSET ${offset} LIMIT ${finalLimit}`;
    
    const { resources } = await container.items.query(query).fetchAll();
    console.log('[BroadcastMessages] Found messages:', resources.length, 'out of potential', limit, 'requested');
    res.json(resources);
  } catch (err) {
    console.error('Error in broadcast messages route:', err);
    // For development, return empty array on error
    if (process.env.NODE_ENV === 'development') {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    // If activating this message, deactivate all others first
    if (req.body.active === true) {
      try {
        const { resources } = await container.items.query('SELECT * FROM c WHERE c.active = true').fetchAll();
        for (const msg of resources) {
          await container.item(msg.id, msg.id).replace({ ...msg, active: false });
        }
      } catch (deactivateErr) {
        console.error('Error deactivating existing messages:', deactivateErr);
        // Continue anyway, but log the error
      }
    }
    
    // Ensure createdAt is set
    if (!req.body.createdAt) {
      req.body.createdAt = new Date().toISOString();
    }
    
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // If activating this message, deactivate all others first
    if (req.body.active === true) {
      try {
        // Get all active messages and filter out the current one
        const { resources } = await container.items.query(
          'SELECT * FROM c WHERE c.active = true'
        ).fetchAll();
        // Filter out the current message and deactivate others
        const otherActiveMessages = resources.filter(msg => msg.id !== id);
        for (const msg of otherActiveMessages) {
          await container.item(msg.id, msg.id).replace({ ...msg, active: false });
        }
      } catch (deactivateErr) {
        console.error('Error deactivating existing messages:', deactivateErr);
        // Continue anyway, but log the error
      }
    }
    
    // Get existing document to preserve createdAt
    let existingDoc;
    try {
      const { resource } = await container.item(id, id).read();
      existingDoc = resource;
    } catch (readErr) {
      // Document doesn't exist or can't be read
    }
    
    // Merge with existing document, preserving createdAt
    const updateData = {
      ...(existingDoc || {}),
      ...req.body,
      id: id, // Ensure ID matches
      createdAt: existingDoc?.createdAt || req.body.createdAt || new Date().toISOString()
    };
    
    const { resource } = await container.item(id, id).replace(updateData);
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', requireRole(['system_admin', 'global_engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 