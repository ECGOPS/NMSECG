const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'userLogs';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[UserLogs] Endpoint:', endpoint);
}

const allRoles = ['system_admin', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician'];

// GET all (read)
router.get('/', requireRole(allRoles), async (req, res) => {
  try {
    console.log('[UserLogs] GET request received with query:', req.query);
    console.log('[UserLogs] Database:', databaseId);
    console.log('[UserLogs] Container:', containerId);
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly"].includes(key)) continue;
      filters.push(`c.${key} = "${req.query[key]}"`);
    }
    if (filters.length) queryStr += ' WHERE ' + filters.join(' AND ');
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    }
              const limit = parseInt(req.query.limit) || 20; // Reduced default limit for faster loading
    const offset = parseInt(req.query.offset) || 0;
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    if (req.query.countOnly === 'true') {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      console.log('[UserLogs] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      return res.json({ count: countResources[0] });
    }
    console.log('[UserLogs] Executing query:', queryStr);
    const { resources } = await container.items.query(queryStr).fetchAll();
    console.log('[UserLogs] Query result:', resources.length, 'logs');
    res.json(resources);
  } catch (err) {
    console.error('Error in user logs route:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(allRoles), async (req, res) => {
  try {
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
    const { resource } = await container.item(id, id).replace(req.body);
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