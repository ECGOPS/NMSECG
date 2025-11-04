const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'vitAssets';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all with filtering, sorting, pagination, and count
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check if includeBase64 parameter is provided
    const includeBase64 = req.query.includeBase64 === 'true';
    
    // Build optimized query - select fields based on includeBase64 parameter
    let queryStr;
    if (includeBase64) {
      // Include all fields including base64 and photos
      queryStr = 'SELECT * FROM c';
    } else {
      // Only select essential fields for better performance (excludes base64 photo)
      queryStr = 'SELECT c.id, c.serialNumber, c.region, c.district, c.feederName, c.voltageLevel, c.typeOfUnit, c.location, c.gpsCoordinates, c.photoUrl, c.status, c.protection, c.type, c.createdBy, c.createdAt, c.updatedAt FROM c';
    }
    
    // Apply role-based filtering
    const filters = [];
    console.log(`[VITAssets] 🔍 Role-based filtering debug:`);
    console.log(`[VITAssets] User object:`, {
      role: req.user?.role,
      region: req.user?.region,
      district: req.user?.district,
      id: req.user?.id
    });
    console.log(`[VITAssets] UserRole from middleware:`, req.userRole);
    
    // Use req.userRole from middleware if req.user.role is not available
    const userRole = req.user?.role || req.userRole;
    const userRegion = req.user?.region;
    const userDistrict = req.user?.district;
    
    console.log(`[VITAssets] Final user role: ${userRole}, region: ${userRegion}, district: ${userDistrict}`);
    
    if (userRole && userRole !== "system_admin" && userRole !== "global_engineer") {
      if (userRole === "district_engineer" || userRole === "technician" || userRole === "district_manager") {
        if (userDistrict) {
          filters.push(`c.district = "${userDistrict}"`);
          console.log(`[VITAssets] ✅ Applied district filter: "${userDistrict}"`);
        } else {
          console.log(`[VITAssets] ⚠️ District role but no district assigned`);
        }
      } else if (userRole === "regional_engineer" || userRole === "regional_general_manager" || userRole === "project_engineer") {
        if (userRegion) {
          filters.push(`c.region = "${userRegion}"`);
          console.log(`[VITAssets] ✅ Applied region filter: "${userRegion}"`);
        } else {
          console.log(`[VITAssets] ⚠️ Regional role but no region assigned`);
        }
      } else if (userRole === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log(`[VITAssets] ✅ Applied ashsubt multi-region filter: ${ashsubtRegions.join(', ')}`);
      } else if (userRole === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log(`[VITAssets] ✅ Applied accsubt multi-region filter: ${accsubtRegions.join(', ')}`);
      } else {
        console.log(`[VITAssets] ℹ️ Role ${userRole} - no filtering applied`);
      }
    } else {
      console.log(`[VITAssets] 🔓 Admin/Global engineer - no filtering applied`);
    }
    
    if (filters.length) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log(`[VITAssets] 🔧 Final filters: ${filters.join(' AND ')}`);
    } else {
      console.log(`[VITAssets] ⚠️ No filters applied - will return all assets`);
    }
    
    // Optimize sorting - use indexed fields
    if (req.query.sort) {
      const sortField = req.query.sort;
      const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';
      queryStr += ` ORDER BY c.${sortField} ${sortOrder}`;
    } else {
      // Default sorting by createdAt for better performance
      queryStr += ' ORDER BY c.createdAt DESC';
    }
    
    // Optimize pagination
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Cap at 100 for performance
    const offset = parseInt(req.query.offset) || 0;
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;
    
    console.log(`[VITAssets] 🔍 Final query: ${queryStr}`);
    console.log(`[VITAssets] IncludeBase64: ${includeBase64}`);
    
    if (req.query.countOnly === 'true') {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c').replace(/SELECT c\.id, c\.serialNumber, c\.region, c\.district, c\.feederName, c\.voltageLevel, c\.typeOfUnit, c\.location, c\.gpsCoordinates, c\.photoUrl, c\.status, c\.protection, c\.type, c\.createdBy, c\.createdAt, c\.updatedAt FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const responseTime = Date.now() - startTime;
      console.log(`[VITAssets] Count result: ${countResources[0]} (${responseTime}ms)`);
      return res.json({ count: countResources[0] });
    }
    
    // Execute query with timeout for better performance
    const queryPromise = container.items.query(queryStr).fetchAll();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 30000)
    );
    
    const { resources } = await Promise.race([queryPromise, timeoutPromise]);
    const responseTime = Date.now() - startTime;
    
    console.log(`[VITAssets] Query result: ${resources.length} assets (${responseTime}ms)`);
    console.log(`[VITAssets] 📊 Sample results:`, resources.slice(0, 3).map(asset => ({
      id: asset.id,
      serialNumber: asset.serialNumber,
      region: asset.region,
      district: asset.district,
      feederName: asset.feederName,
      typeOfUnit: asset.typeOfUnit,
      type: asset.type,
      createdBy: asset.createdBy
    })));
    
    res.json(resources);
  } catch (err) {
    console.error('Error in VIT assets route:', err);
    res.status(500).json({ error: err.message });
  }
});

// Lightweight endpoint for testing performance
router.get('/test/performance', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Simple query to test performance
    const queryStr = 'SELECT c.id, c.serialNumber, c.region, c.district FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 10';
    
    const { resources } = await container.items.query(queryStr).fetchAll();
    const responseTime = Date.now() - startTime;
    
    console.log(`[VITAssets] Performance test: ${resources.length} assets (${responseTime}ms)`);
    
    res.json({ 
      count: resources.length, 
      responseTime: `${responseTime}ms`,
      sample: resources.slice(0, 3)
    });
  } catch (err) {
    console.error('Error in VIT assets performance test:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick count endpoint for performance monitoring
router.get('/count', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Build count query with filters
    let queryStr = 'SELECT VALUE COUNT(1) FROM c';
    const filters = [];
    const queryOptions = { parameters: [] };
    
    // Apply filters efficiently
    for (const key in req.query) {
      if (req.query[key] && req.query[key].trim() !== '') {
        filters.push(`c.${key} = @${key}`);
        queryOptions.parameters.push({ name: `@${key}`, value: req.query[key].trim() });
      }
    }
    
    if (filters.length) {
      queryStr += ' WHERE ' + filters.join(' AND ');
    }
    
    const { resources } = await container.items.query(queryStr, queryOptions).fetchAll();
    const responseTime = Date.now() - startTime;
    
    console.log(`[VITAssets] Count result: ${resources[0]} (${responseTime}ms)`);
    
    res.json({ 
      count: resources[0] || 0,
      responseTime: `${responseTime}ms`
    });
  } catch (err) {
    console.error('Error in VIT assets count:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    
    if (!resource) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(resource);
  } catch (err) {
    console.error('Error in VIT asset by ID route:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { resource } = await container.items.create(req.body);
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[VITAssets] PUT /:id - Updating asset ${id}`);
    console.log(`[VITAssets] Request body keys:`, Object.keys(req.body));
    console.log(`[VITAssets] Request body:`, JSON.stringify(req.body, null, 2));
    
    // Read existing resource to preserve metadata and merge with updates
    let existingResource;
    try {
      const readResult = await container.item(id, id).read();
      existingResource = readResult.resource;
      console.log(`[VITAssets] Existing resource found, keys:`, Object.keys(existingResource));
    } catch (readErr) {
      console.error(`[VITAssets] Error reading existing resource:`, readErr);
      if (readErr.code === 404) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      throw readErr;
    }
    
    // Merge existing resource with new data (same pattern as overheadLineInspections)
    const updated = {
      ...existingResource,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    console.log(`[VITAssets] Merged update data keys:`, Object.keys(updated));
    console.log(`[VITAssets] Sample data:`, {
      id: updated.id,
      serialNumber: updated.serialNumber,
      feederName: updated.feederName,
      region: updated.region,
      district: updated.district
    });
    
    // Replace the item with merged data (same as overheadLineInspections)
    const { resource } = await container.item(id, id).replace(updated);
    console.log(`[VITAssets] Successfully updated asset ${id}`);
    res.json(resource);
  } catch (err) {
    console.error('[VITAssets] Error updating VIT asset:', err);
    console.error('[VITAssets] Error details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// DELETE
router.delete('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 