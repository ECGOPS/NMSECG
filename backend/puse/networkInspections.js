const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'overheadLineInspections';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all network inspections
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician']), async (req, res) => {
  try {
    let queryStr = 'SELECT * FROM c WHERE c.type = "networkInspection"';
    
    // Apply role-based filtering
    const filters = [];
    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "technician" || req.user.role === "district_manager") {
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
        }
      }
    }

    // Add filters to query
    if (filters.length > 0) {
      queryStr += ' AND ' + filters.join(' AND ');
    }

    const { resources } = await container.items.query(queryStr).fetchAll();
    res.json(resources);
  } catch (error) {
    console.error('Error fetching network inspections:', error);
    res.status(500).json({ error: 'Failed to fetch network inspections' });
  }
});

// GET single network inspection by ID
router.get('/:id', async (req, res) => {
  try {
    const { resource } = await container.item(req.params.id, req.params.id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Network inspection not found' });
    }
    res.json(resource);
  } catch (error) {
    console.error('Error fetching network inspection:', error);
    res.status(500).json({ error: 'Failed to fetch network inspection' });
  }
});

// POST new network inspection
router.post('/', async (req, res) => {
  try {
    const newInspection = {
      ...req.body,
      type: 'networkInspection',
      createdAt: new Date().toISOString(),
      createdBy: req.userId || 'dev-user-id'
    };
    const { resource } = await container.items.create(newInspection);
    res.status(201).json(resource);
  } catch (error) {
    console.error('Error creating network inspection:', error);
    res.status(500).json({ error: 'Failed to create network inspection' });
  }
});

// PUT update network inspection
router.put('/:id', async (req, res) => {
  try {
    const { resource } = await container.item(req.params.id, req.params.id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Network inspection not found' });
    }
    
    const updatedInspection = {
      ...resource,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.userId || 'dev-user-id'
    };
    
    const { resource: updated } = await container.item(req.params.id, req.params.id).replace(updatedInspection);
    res.json(updated);
  } catch (error) {
    console.error('Error updating network inspection:', error);
    res.status(500).json({ error: 'Failed to update network inspection' });
  }
});

// DELETE network inspection
router.delete('/:id', async (req, res) => {
  try {
    await container.item(req.params.id, req.params.id).delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting network inspection:', error);
    res.status(500).json({ error: 'Failed to delete network inspection' });
  }
});

module.exports = router; 