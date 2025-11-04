const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole, requireAuth } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'districts';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log environment variables only in development
if (process.env.NODE_ENV === 'development') {
  console.log('Districts route - Environment variables:');
  console.log('COSMOS_DB_ENDPOINT:', process.env.COSMOS_DB_ENDPOINT);
  console.log('endpoint variable:', endpoint);
}

// GET all - requires authentication and appropriate role
router.get('/', requireAuth(), requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[Districts] GET request received with query:', req.query);
    console.log('[Districts] Database:', databaseId);
    console.log('[Districts] Container:', containerId);
    
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
    console.log('[Districts] Successfully fetched', resources.length, 'districts from database');
    
    // Filter by regionId if provided
    const { regionId } = req.query;
    if (regionId) {
      const filteredDistricts = resources.filter(d => d.regionId === regionId);
      console.log('[Districts] Filtered to', filteredDistricts.length, 'districts for regionId:', regionId);
      return res.json(filteredDistricts);
    }
    
    console.log('[Districts] Returning all', resources.length, 'districts');
    res.json(resources);
  } catch (err) {
    console.error('[Districts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create) - requires authentication and appropriate role
router.post('/', requireAuth(), requireRole(['system_admin', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[Districts] POST request received:', req.body);
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    console.error('[Districts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) - requires authentication and appropriate role
router.put('/:id', requireAuth(), requireRole(['system_admin', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Districts] PUT request received for ID:', id, 'Data:', req.body);
    
    // First, get the existing district
    const { resource: existingDistrict } = await container.item(id, id).read();
    if (!existingDistrict) {
      return res.status(404).json({ error: 'District not found' });
    }
    
    // Merge the updates with the existing data
    const updatedDistrict = {
      ...existingDistrict,
      ...req.body,
      id: id // Ensure id is included
    };
    
    console.log('[Districts] Updated district data:', updatedDistrict);
    
    const { resource } = await container.item(id, id).replace(updatedDistrict);
    res.json(resource);
  } catch (err) {
    console.error('[Districts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - requires authentication and admin role
router.delete('/:id', requireAuth(), requireRole(['system_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Districts] DELETE request received for ID:', id);
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('[Districts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 