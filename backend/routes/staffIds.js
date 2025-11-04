const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'staffIds';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[StaffIds] Endpoint:', endpoint);
}

// GET all - requires authentication and appropriate role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[StaffIds] GET request received with query:', req.query);
    console.log('[StaffIds] Database:', databaseId);
    console.log('[StaffIds] Container:', containerId);
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    
    // Apply role-based filtering
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly", "startAfter"].includes(key)) continue;
      filters.push(`c.${key} = "${req.query[key]}"`);
    }
    
    if (filters.length) queryStr += ' WHERE ' + filters.join(' AND ');
    
    // Apply sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      // Default sorting by createdAt for better performance
      queryStr += ' ORDER BY c.createdAt DESC';
    }
    
    // Apply pagination
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Cap at 100 for performance
    const offset = parseInt(req.query.offset) || 0;
    
    // Support both offset-based and cursor-based pagination
    if (req.query.startAfter) {
      // Cursor-based pagination for better performance
      queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    } else {
      // Traditional offset-based pagination
      queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    }
    
    // Support countOnly for getting just the count
    if (req.query.countOnly === 'true') {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      return res.json({ count: countResources[0] });
    }
    
    console.log('[StaffIds] Executing query:', queryStr);
    const { resources } = await container.items.query(queryStr).fetchAll();
    console.log('[StaffIds] Query result:', resources.length, 'staff IDs');
    res.json(resources);
  } catch (err) {
    console.error('[StaffIds] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - requires authentication and admin role
router.post('/', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[StaffIds] POST request received:', req.body);
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    console.error('[StaffIds] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - requires authentication and admin role
router.put('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[StaffIds] PUT request received for ID:', id, 'Data:', req.body);
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    console.error('[StaffIds] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - requires authentication and admin role
router.delete('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[StaffIds] DELETE request received for ID:', id);
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('[StaffIds] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 