const express = require('express');
const { CosmosClient } = require('@azure/cosmos');
const { requireRole } = require('../roles');

const router = express.Router();
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = 'op5Faults';
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const container = database.container(containerId);

// Log endpoint status only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[OP5Faults] Endpoint:', endpoint);
}

// GET all
router.get('/', requireRole(['system_admin', 'global_engineer', 'regional_engineer', 'project_engineer', 'district_engineer', 'regional_general_manager', 'district_manager', 'ict', 'technician', 'ashsubt', 'accsubt']), async (req, res) => {
  try {
    console.log('[OP5Faults] GET request received with query:', req.query);
    console.log('[OP5Faults] Database:', databaseId);
    console.log('[OP5Faults] Container:', containerId);
    console.log('[OP5Faults] User info:', {
      role: req.user?.role,
      district: req.user?.district,
      region: req.user?.region,
      userId: req.user?.id
    });
    
    let queryStr = 'SELECT * FROM c';
    const filters = [];
    
    // Apply role-based filtering if no regionId is provided (for all non-admin/global roles)
    if (!req.query.regionId && !req.query.districtId && req.user && req.user.role !== "system_admin" && req.user.role !== "global_engineer") {
      console.log('[OP5Faults] Applying role-based filtering for role:', req.user.role);
      
      if (req.user.role === "district_engineer" || req.user.role === "district_manager" || req.user.role === "technician") {
        // District-level roles - filter by district
        if (req.user.district) {
          filters.push(`c.district = "${req.user.district}"`);
          console.log('[OP5Faults] Filtering by district:', req.user.district);
        }
      } else if (req.user.role === "regional_engineer" || req.user.role === "regional_general_manager" || req.user.role === "project_engineer") {
        // Regional-level roles - filter by region
        if (req.user.region) {
          filters.push(`c.region = "${req.user.region}"`);
          console.log('[OP5Faults] Filtering by region:', req.user.region);
        }
      } else if (req.user.role === "ashsubt") {
        // Ashsubt users can see multiple regions: SUBTRANSMISSION ASHANTI, ASHANTI EAST, ASHANTI WEST, ASHANTI SOUTH
        const ashsubtRegions = ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'];
        const regionConditions = ashsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[OP5Faults] Added ashsubt multi-region filter:', ashsubtRegions.join(', '));
      } else if (req.user.role === "accsubt") {
        // Accsubt users can see multiple regions: SUBTRANSMISSION ACCRA, ACCRA EAST, ACCRA WEST
        const accsubtRegions = ['SUBTRANSMISSION ACCRA', 'ACCRA EAST REGION', 'ACCRA WEST REGION'];
        const regionConditions = accsubtRegions.map(r => `c.region = "${r}"`);
        filters.push(`(${regionConditions.join(' OR ')})`);
        console.log('[OP5Faults] Added accsubt multi-region filter:', accsubtRegions.join(', '));
      }
    }
    
    for (const key in req.query) {
      if (["sort", "order", "limit", "offset", "countOnly"].includes(key)) continue;
      if (key === 'startDate') {
        filters.push(`c.occurrenceDate >= "${req.query[key]}"`);
      } else if (key === 'endDate') {
        filters.push(`c.occurrenceDate <= "${req.query[key]}"`);
      } else if (key === 'date') {
        // Handle date filtering for occurrenceDate field
        const dateValue = req.query[key];
        filters.push(`c.occurrenceDate >= "${dateValue}T00:00:00.000Z" AND c.occurrenceDate <= "${dateValue}T23:59:59.999Z"`);
      } else {
        filters.push(`c.${key} = "${req.query[key]}"`);
      }
    }
    if (filters.length) queryStr += ' WHERE ' + filters.join(' AND ');
    if (req.query.sort) {
      queryStr += ` ORDER BY c.${req.query.sort} ${req.query.order === 'desc' ? 'DESC' : 'ASC'}`;
    }
              const limit = parseInt(req.query.limit) || 20; // Reduced default limit for faster loading
    const offset = parseInt(req.query.offset) || 0;
    const countOnly = req.query.countOnly === 'true';
    
    // Validate and cap limit to prevent performance issues
    const maxLimit = 1000; // Maximum limit to prevent excessive memory usage
    const finalLimit = Math.min(limit, maxLimit);
    
    // Performance warning for large queries
    if (limit > 500) {
      console.warn('[OP5Faults] Large query requested:', {
        requestedLimit: limit,
        finalLimit,
        warning: 'Large queries may impact performance'
      });
    }
    
    console.log('[OP5Faults] Pagination params:', {
      requestedLimit: limit,
      finalLimit,
      offset,
      countOnly
    });
    
    // Count-only shortcut for better performance
    if (countOnly) {
      const countQuery = queryStr.replace(/SELECT \* FROM c/, 'SELECT VALUE COUNT(1) FROM c');
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      const totalCount = countResources[0] ?? 0;
      
      console.log('[OP5Faults] Count query result:', totalCount);
      return res.json({ total: totalCount });
    }
    
    // Add pagination to main query
    queryStr += ` OFFSET ${offset} LIMIT ${finalLimit}`;
    
    // Execute paginated query
    console.log('[OP5Faults] Final query:', queryStr);
    const startTime = Date.now();
    let resources = [];
    let executionTime = 0;
    
    try {
      const result = await container.items.query(queryStr).fetchAll();
      resources = result.resources;
      executionTime = Date.now() - startTime;
      console.log('[OP5Faults] Query executed successfully in', executionTime, 'ms');
    } catch (queryError) {
      console.error('[OP5Faults] Query execution error:', queryError);
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
      
      // Execute the count query
      const { resources: countResources } = await container.items.query(countQuery).fetchAll();
      totalCount = countResources[0] ?? 0;
      
      console.log('[OP5Faults] Count query result:', totalCount);
    } catch (countError) {
      console.error('[OP5Faults] Count query error:', countError);
      // Don't fail the request, just use the current page count
      totalCount = resources.length;
    }
    
    // Enhanced logging with performance metrics
    console.log('[OP5Faults] Query completed:', {
      totalRecords: totalCount,
      returnedRecords: resources.length,
      executionTime: `${executionTime}ms`,
      pagination: { offset, limit: finalLimit, page: Math.floor(offset / finalLimit) + 1 }
    });
    
    // Return paginated response with metadata
    res.json({
      data: resources,
      total: totalCount,
      page: Math.floor(offset / finalLimit) + 1,
      pageSize: finalLimit,
      totalPages: Math.ceil(totalCount / finalLimit),
      hasNextPage: offset + finalLimit < totalCount,
      hasPreviousPage: offset > 0
    });
  } catch (err) {
    console.error('Error in OP5 faults route:', err);
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
    console.log('Updating OP5 fault:', id, 'with data:', req.body);
    
    // First, get the existing fault
    const { resource: existingFault } = await container.item(id, id).read();
    if (!existingFault) {
      return res.status(404).json({ error: 'OP5 fault not found' });
    }
    
    // Merge the updates with the existing data
    const updatedFault = {
      ...existingFault,
      ...req.body,
      id: id // Ensure id is included
    };
    
    console.log('Updated OP5 fault data:', updatedFault);
    
    const { resource } = await container.item(id, id).replace(updatedFault);
    res.json(resource);
  } catch (err) {
    console.error('Error updating OP5 fault:', err);
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