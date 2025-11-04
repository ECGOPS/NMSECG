const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'vitInspections';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all with filtering, sorting, pagination, and count
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[VITInspections] Request received:', {
      method: req.method,
      url: req.url,
      query: req.query,
      user: req.user
    });

    // Check if container exists
    try {
      await container.read();
      console.log('[VITInspections] Container exists and is accessible');
    } catch (containerError) {
      console.error('[VITInspections] Container error:', containerError);
      return res.status(500).json({
        error: 'Database container not accessible',
        details: containerError.message,
        code: containerError.code
      });
    }

    // Use optimized query for better performance - include all checklist fields
    let queryStr = 'SELECT c.id, c.vitAssetId, c.inspectionDate, c.inspectedBy, c.status, c.notes, c.createdAt, c.updatedAt, c.region, c.district, c.feederName, c.feederAlias, c.rodentTermiteEncroachment, c.cleanDustFree, c.protectionButtonEnabled, c.recloserButtonEnabled, c.groundEarthButtonEnabled, c.acPowerOn, c.batteryPowerLow, c.handleLockOn, c.remoteButtonEnabled, c.gasLevelLow, c.earthingArrangementAdequate, c.noFusesBlown, c.noDamageToBushings, c.noDamageToHVConnections, c.insulatorsClean, c.paintworkAdequate, c.ptFuseLinkIntact, c.noCorrosion, c.silicaGelCondition, c.correctLabelling, c.remarks, c.photoUrls FROM c';

    // Apply role-based filtering with enhanced logging
    const filters = [];
    console.log('[VITInspections] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });

    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "technician" || req.user.role === "district_manager") {
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[VITInspections] Added district filter:', req.user.district);
        } else {
          console.log('[VITInspections] No district found for user:', req.user.role);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[VITInspections] Added region filter:', req.user.region);
        } else {
          console.log('[VITInspections] No region found for user:', req.user.role);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[VITInspections] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[VITInspections] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      } else {
        console.log('[VITInspections] User role not handled for filtering:', req.user.role);
      }
    } else {
      console.log('[VITInspections] Admin/Global engineer - no filtering applied');
    }

    // Add additional filters from query parameters
    if (req.query.region && req.query.region !== 'all') {
      filters.push(`c.region = "${req.query.region}"`);
      console.log('[VITInspections] Added region filter from query:', req.query.region);
    }
    
    if (req.query.district && req.query.district !== 'all') {
      filters.push(`c.district = "${req.query.district}"`);
      console.log('[VITInspections] Added district filter from query:', req.query.district);
    }
    
    if (req.query.inspectedBy && req.query.inspectedBy !== 'all') {
      filters.push(`c.inspectedBy = "${req.query.inspectedBy}"`);
      console.log('[VITInspections] Added inspector filter from query:', req.query.inspectedBy);
    }
    
    if (req.query.status && req.query.status !== 'all') {
      filters.push(`c.status = "${req.query.status}"`);
      console.log('[VITInspections] Added status filter from query:', req.query.status);
    }
    
    if (req.query.vitAssetId) {
      filters.push(`c.vitAssetId = "${req.query.vitAssetId}"`);
      console.log('[VITInspections] Added vitAssetId filter from query:', req.query.vitAssetId);
    }

    // Add filters to query
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log('[VITInspections] Applied filters:', filters);
    } else {
      console.log('[VITInspections] No filters applied');
    }

    // Add sorting
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      queryStr += ' ORDER BY c.createdAt DESC';
    }

    // Extract pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';

    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT c\.id, c\.vitAssetId, c\.inspectionDate, c\.inspectedBy, c\.status, c\.notes, c\.createdAt, c\.updatedAt, c\.region, c\.district, c\.feederName, c\.feederAlias, c\.rodentTermiteEncroachment, c\.cleanDustFree, c\.protectionButtonEnabled, c\.recloserButtonEnabled, c\.groundEarthButtonEnabled, c\.acPowerOn, c\.batteryPowerLow, c\.handleLockOn, c\.remoteButtonEnabled, c\.gasLevelLow, c\.earthingArrangementAdequate, c\.noFusesBlown, c\.noDamageToBushings, c\.noDamageToHVConnections, c\.insulatorsClean, c\.paintworkAdequate, c\.ptFuseLinkIntact, c\.noCorrosion, c\.silicaGelCondition, c\.correctLabelling, c\.remarks, c\.photoUrls FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;

      console.log('[VITInspections] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }

    // Add pagination to main query
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;

    // Execute paginated query
    console.log('[VITInspections] Final query:', queryStr);
    const startTime = Date.now();
    let resources = [];
    let executionTime = 0;
    
    try {
      const result = await container.items.query(queryStr).fetchAll();
      resources = result.resources;
      executionTime = Date.now() - startTime;
      console.log('[VITInspections] Query executed successfully in', executionTime, 'ms');
    } catch (queryError) {
      console.error('[VITInspections] Query execution error:', queryError);
      return res.status(500).json({
        error: 'Database query failed',
        details: queryError.message,
        code: queryError.code,
        query: queryStr
      });
    }

    // Get total count without pagination for accurate pagination info
    let totalCount = 0;
    try {
      // Build count query with same filters but without pagination
      let countQuery = 'SELECT VALUE COUNT(1) FROM c';
      
      // Add the same filters that were applied to the main query
      if (filters.length > 0) {
        countQuery += ' WHERE ' + filters.join(' AND ');
      }
      
      console.log('[VITInspections] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      console.log('[VITInspections] Count query result:', totalCount);
    } catch (countError) {
      console.error('[VITInspections] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }

    // Enhanced logging with performance metrics
    console.log('[VITInspections] Query result:', {
      count: resources.length,
      total: totalCount,
      executionTime: `${executionTime}ms`,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
        offset,
        limit
      },
      sample: resources.slice(0, 2).map(item => ({
        id: item.id,
        vitAssetId: item.vitAssetId,
        inspectionDate: item.inspectionDate,
        inspectedBy: item.inspectedBy,
        status: item.status
      }))
    });

    // Structured response with pagination metadata
    res.json({
      data: resources,
      total: totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: (Math.floor(offset / limit) + 1) < Math.ceil(totalCount / limit),
      hasPreviousPage: offset > 0
    });

  } catch (err) {
    console.error('Error in VIT inspections route:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
    });
    res.status(500).json({
      error: err.message,
      details: err.stack,
      code: err.code
    });
  }
});

// GET by ID
router.get('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    if (!resource) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST (create)
router.post('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[VITInspections] POST request received:', {
      body: req.body,
      bodyKeys: Object.keys(req.body),
      bodyValues: Object.values(req.body),
      hasChecklistFields: {
        rodentTermiteEncroachment: req.body.rodentTermiteEncroachment,
        cleanDustFree: req.body.cleanDustFree,
        protectionButtonEnabled: req.body.protectionButtonEnabled,
        batteryPowerLow: req.body.batteryPowerLow,
        gasLevelLow: req.body.gasLevelLow,
        silicaGelCondition: req.body.silicaGelCondition
      }
    });
    
    const { resource } = await container.items.create(req.body);
    
    console.log('[VITInspections] Created inspection:', {
      id: resource.id,
      savedFields: Object.keys(resource),
      hasChecklistData: {
        rodentTermiteEncroachment: resource.rodentTermiteEncroachment,
        cleanDustFree: resource.cleanDustFree,
        protectionButtonEnabled: resource.protectionButtonEnabled
      }
    });
    
    res.status(201).json(resource);
  } catch (err) {
    console.error('[VITInspections] POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT (update)
router.put('/:id', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[VITInspections] PUT request received:', {
      id,
      body: req.body,
      bodyKeys: Object.keys(req.body),
      hasChecklistFields: {
        rodentTermiteEncroachment: req.body.rodentTermiteEncroachment,
        cleanDustFree: req.body.cleanDustFree,
        protectionButtonEnabled: req.body.protectionButtonEnabled,
        batteryPowerLow: req.body.batteryPowerLow,
        gasLevelLow: req.body.gasLevelLow,
        silicaGelCondition: req.body.silicaGelCondition
      }
    });
    
    const { resource } = await container.item(id, id).replace(req.body);
    
    console.log('[VITInspections] Updated inspection:', {
      id: resource.id,
      savedFields: Object.keys(resource),
      hasChecklistData: {
        rodentTermiteEncroachment: resource.rodentTermiteEncroachment,
        cleanDustFree: resource.cleanDustFree,
        protectionButtonEnabled: resource.protectionButtonEnabled
      }
    });
    
    res.json(resource);
  } catch (err) {
    console.error('[VITInspections] PUT error:', err);
    res.status(500).json({ error: err.message });
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