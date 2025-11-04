const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'feeders';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all (read) - with optional region filtering
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    let query = 'SELECT * FROM c';
    const parameters = [];
    
    // Filter by region if regionId is provided
    if (req.query.regionId) {
      query = 'SELECT * FROM c WHERE c.regionId = @regionId';
      parameters.push({
        name: '@regionId',
        value: req.query.regionId
      });
    }
    
    const { resources } = await container.items.query(query, { parameters }).fetchAll();
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - role and region/district checks
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'district_engineer', 'district_manager', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    // TODO: Implement region/district checks as per Firestore rules
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - role and region/district checks
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'district_engineer', 'district_manager', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    // TODO: Implement region/district checks as per Firestore rules
    const { id } = req.params;
    const { resource } = await container.item(id, id).replace(req.body);
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - only system_admin or global_engineer
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