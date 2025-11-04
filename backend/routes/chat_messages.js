const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'chat_messages';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all (read)
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    // For development, return empty array if database is not configured
    if (!endpoint || endpoint.includes('dev-cosmos-endpoint')) {
      console.log('Development mode: returning empty chat messages array');
      return res.json([]);
    }
    
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    res.json(resources);
  } catch (err) {
    console.error('Error in chat messages route:', err);
    // For development, return empty array on error
    if (process.env.NODE_ENV === 'development') {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - senderId must match userId
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    if (req.body.senderId !== req.userId) {
      return res.status(403).json({ error: 'SenderId must match authenticated user' });
    }
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - only sender can update
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    // Fetch the message to check senderId
    const { resource: message } = await container.item(id, id).read();
    if (!message || message.senderId !== req.userId) {
      return res.status(403).json({ error: 'Only sender can update' });
    }
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - only sender can delete
router.delete('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource: message } = await container.item(id, id).read();
    if (!message || message.senderId !== req.userId) {
      return res.status(403).json({ error: 'Only sender can delete' });
    }
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 