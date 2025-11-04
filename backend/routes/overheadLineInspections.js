const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');
const dynamicPermissions = require('../middleware/dynamicPermissions');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'overheadLineInspections';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// GET all
router.get('/', dynamicPermissions.requireAccess('overhead_line_inspection'), async (req, res) => {
  try {
    console.log('[OverheadLineInspections] Request received:', {
      method: req.method,
      url: req.url,
      query: req.query,
      user: req.user
    });

    // Check if container exists
    try {
      await container.read();
      console.log('[OverheadLineInspections] Container exists and is accessible');
    } catch (containerError) {
      console.error('[OverheadLineInspections] Container error:', containerError);
      return res.status(500).json({
        error: 'Database container not accessible',
        details: containerError.message,
        code: containerError.code
      });
    }

    // Always use optimized query since we've migrated to blob storage
    // No need for base64 data anymore - images are stored as URLs
    // Select all fields to ensure complete data is returned for edit/view
    let queryStr = 'SELECT * FROM c';

    // Apply role-based filtering with enhanced logging
    const filters = [];
    console.log('[OverheadLineInspections] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });

    if (req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      if (req.user.role === "district_engineer" || req.user.role === "technician" || req.user.role === "district_manager") {
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[OverheadLineInspections] Added district filter:', req.user.district);
        } else {
          console.log('[OverheadLineInspections] No district found for user:', req.user.role);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[OverheadLineInspections] Added region filter:', req.user.region);
        } else {
          console.log('[OverheadLineInspections] No region found for user:', req.user.role);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[OverheadLineInspections] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[OverheadLineInspections] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      } else {
        console.log('[OverheadLineInspections] User role not handled for filtering:', req.user.role);
      }
    } else {
      console.log('[OverheadLineInspections] Admin/Global engineer - no filtering applied');
    }

    // Add additional filters from query parameters
    if (req.query.region && req.query.region !== 'all') {
      filters.push(`c.region = "${req.query.region}"`);
      console.log('[OverheadLineInspections] Added region filter from query:', req.query.region);
    }
    
    if (req.query.district && req.query.district !== 'all') {
      filters.push(`c.district = "${req.query.district}"`);
      console.log('[OverheadLineInspections] Added district filter from query:', req.query.district);
    }
    
    if (req.query.feeder && req.query.feeder !== 'all') {
      filters.push(`c.feederName = "${req.query.feeder}"`);
      console.log('[OverheadLineInspections] Added feeder filter from query:', req.query.feeder);
    }
    
    if (req.query.date) {
      // Handle both date field and createdAt timestamp
      // Convert the date to timestamp for comparison with createdAt._seconds
      const dateObj = new Date(req.query.date);
      const timestamp = Math.floor(dateObj.getTime() / 1000);
      const nextDayTimestamp = timestamp + 86400; // Add 24 hours
      
      filters.push(`(c.date = "${req.query.date}" OR (c.createdAt._seconds >= ${timestamp} AND c.createdAt._seconds < ${nextDayTimestamp}))`);
      console.log('[OverheadLineInspections] Added date filter from query:', req.query.date, 'timestamp range:', timestamp, 'to', nextDayTimestamp);
    }
    
    if (req.query.month) {
      filters.push(`c.date LIKE "${req.query.month}%"`);
      console.log('[OverheadLineInspections] Added month filter from query:', req.query.month);
    }

    // Add filters to query
    if (filters.length > 0) {
      queryStr += ' WHERE ' + filters.join(' AND ');
      console.log('[OverheadLineInspections] Applied filters:', filters);
    } else {
      console.log('[OverheadLineInspections] No filters applied');
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
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;

      console.log('[OverheadLineInspections] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }

    // Add pagination to main query
    queryStr += ` OFFSET ${offset} LIMIT ${limit}`;

    // Execute paginated query
    console.log('[OverheadLineInspections] Final query:', queryStr);
    const startTime = Date.now();
    let resources = [];
    let executionTime = 0;
    
    try {
      const result = await container.items.query(queryStr).fetchAll();
      resources = result.resources;
      executionTime = Date.now() - startTime;
      console.log('[OverheadLineInspections] Query executed successfully in', executionTime, 'ms');
    } catch (queryError) {
      console.error('[OverheadLineInspections] Query execution error:', queryError);
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
      
      console.log('[OverheadLineInspections] Count query:', countQuery);
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      console.log('[OverheadLineInspections] Count query result:', totalCount);
    } catch (countError) {
      console.error('[OverheadLineInspections] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }

    // Enhanced logging with performance metrics
    console.log('[OverheadLineInspections] Query result:', {
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
        region: item.region,
        district: item.district,
        status: item.status,
        hasImages: !!(item.images || item.afterImages),
        hasPoleCondition: !!item.poleCondition,
        hasStayCondition: !!item.stayCondition,
        hasCrossArmCondition: !!item.crossArmCondition,
        hasInsulatorCondition: !!item.insulatorCondition,
        hasConductorCondition: !!item.conductorCondition,
        hasLightningArresterCondition: !!item.lightningArresterCondition,
        hasDropOutFuseCondition: !!item.dropOutFuseCondition,
        hasTransformerCondition: !!item.transformerCondition,
        hasRecloserCondition: !!item.recloserCondition,
        hasVegetationConflicts: !!item.vegetationConflicts,
        voltageLevel: item.voltageLevel,
        groundCondition: item.groundCondition,
        location: item.location,
        latitude: item.latitude,
        longitude: item.longitude,
        allKeys: Object.keys(item)
      }))
    });

    // Structured response with pagination metadata
    const response = {
      data: resources,
      total: totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: (Math.floor(offset / limit) + 1) < Math.ceil(totalCount / limit),
      hasPreviousPage: offset > 0
    };
    
    console.log('[OverheadLineInspections] Sending response:', {
      dataLength: response.data.length,
      firstRecordKeys: response.data.length > 0 ? Object.keys(response.data[0]) : [],
      firstRecordChecklistFields: response.data.length > 0 ? {
        hasPoleCondition: !!response.data[0].poleCondition,
        hasStayCondition: !!response.data[0].stayCondition,
        hasCrossArmCondition: !!response.data[0].crossArmCondition,
        hasInsulatorCondition: !!response.data[0].insulatorCondition,
        hasConductorCondition: !!response.data[0].conductorCondition,
        hasLightningArresterCondition: !!response.data[0].lightningArresterCondition,
        hasDropOutFuseCondition: !!response.data[0].dropOutFuseCondition,
        hasTransformerCondition: !!response.data[0].transformerCondition,
        hasRecloserCondition: !!response.data[0].recloserCondition,
        hasVegetationConflicts: !!response.data[0].vegetationConflicts
      } : {}
    });
    
    res.json(response);

  } catch (err) {
    console.error('Error in overhead line inspections route:', err);
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
router.get('/:id', dynamicPermissions.requireAccess('overhead_line_inspection'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource } = await container.item(id, id).read();
    res.json(resource);
  } catch (err) {
    console.error('Error fetching overhead line inspection by ID:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST new
router.post('/', dynamicPermissions.requireCreate('overhead_line_inspection'), async (req, res) => {
  try {
    console.log('[OverheadLineInspections] POST request received');
    console.log('[OverheadLineInspections] Request body keys:', Object.keys(req.body));
    console.log('[OverheadLineInspections] Has vegetationConflicts:', !!req.body.vegetationConflicts);
    console.log('[OverheadLineInspections] Has afterImages:', req.body.afterImages !== undefined);
    console.log('[OverheadLineInspections] referencePole:', req.body.referencePole);
    console.log('[OverheadLineInspections] poleId:', req.body.poleId);
    
    const inspection = {
      ...req.body,
      id: req.body.id || Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('[OverheadLineInspections] Final inspection keys:', Object.keys(inspection));
    console.log('[OverheadLineInspections] Final vegetationConflicts:', inspection.vegetationConflicts);
    
    const { resource } = await container.items.create(inspection);
    res.status(201).json(resource);
  } catch (err) {
    console.error('Error creating overhead line inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update
router.put('/:id', dynamicPermissions.requireUpdate('overhead_line_inspection'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resource: existing } = await container.item(id, id).read();
    const updated = {
      ...existing,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    const { resource } = await container.item(id, id).replace(updated);
    res.json(resource);
  } catch (err) {
    console.error('Error updating overhead line inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', dynamicPermissions.requireDelete('overhead_line_inspection'), async (req, res) => {
  try {
    const { id } = req.params;
    await container.item(id, id).delete();
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting overhead line inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 