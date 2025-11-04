const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'system';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[System] Endpoint:', endpoint);
}

// GET all - requires authentication and appropriate role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    console.log('[System] GET request received with query:', req.query);
    console.log('[System] Database:', databaseId);
    console.log('[System] Container:', containerId);
    
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    res.json(resources);
  } catch (err) {
    console.error('[System] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - requires authentication and admin role
router.post('/', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    console.log('[System] POST request received:', req.body);
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    console.error('[System] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - requires authentication and admin role
router.put('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[System] PUT request received for ID:', id, 'Data:', req.body);
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    console.error('[System] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - requires authentication and admin role
router.delete('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[System] DELETE request received for ID:', id);
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('[System] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 