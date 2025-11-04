const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'sms_logs';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

const allRoles = ['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'district_engineer', 'district_manager', 'technician'];

// GET all (read)
router.get('/', requireRole(allRoles), async (req, res) => {
  try {
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    res.json(resources);
  } catch (err) {
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