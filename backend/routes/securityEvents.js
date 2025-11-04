const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'securityEvents';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[SecurityEvents] Endpoint:', endpoint);
}

// GET all
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    console.log('[SecurityEvents] GET request received with query:', req.query);
    console.log('[SecurityEvents] Database:', databaseId);
    console.log('[SecurityEvents] Container:', containerId);
    
    // For development, return empty array if database is not configured
    if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
      console.log('[SecurityEvents] Development mode: returning empty security events array');
      return res.json([]);
    }
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    
    // Add filtering
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly"].includes(key)) continue;
      filters.push(`c.${key} = "${req.query[key]}"`);
    }
    if (filters.length) queryStr += ' WHERE ' + filters.join(' AND ');
    
    // Add sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      queryStr += ' ORDER BY c.timestamp DESC';
    }
    
    // Add pagination
    const limit = parseInt(req.query.limit) || 20; // Reduced default limit for faster loading
    const offset = parseInt(req.query.offset) || 0;
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    
    console.log('[SecurityEvents] Executing query:', queryStr);
    
    const { resources: items, diagnostics } = await container.items.query(queryStr, { maxItemCount: limit }).fetchAll();
    const executionTime = diagnostics ? `${diagnostics.clientSideRequestStatistics.requestDurationInMs}ms` : 'N/A';
    
    console.log('[SecurityEvents] Query result:', {
      count: items.length,
      executionTime,
      sample: items.slice(0, 2).map(item => ({
        id: item.id,
        eventType: item.eventType,
        severity: item.severity,
        timestamp: item.timestamp
      }))
    });
    
    res.json(items);
  } catch (err) {
    console.error('Error in security events route:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
    });
    // For development, return empty array on error
    if (process.env.NODE_ENV === 'development') {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 